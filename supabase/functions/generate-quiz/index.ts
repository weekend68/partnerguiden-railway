import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Quiz questions are generated here as an admin-triggered draft (reviewed and
// saved via the article editor's normal save flow into quiz_questions), not
// live per-visitor anymore - Gemini's latency/503-under-load made on-demand
// generation for every quiz page load unusable.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Error checking admin role:", roleError);
      return new Response(JSON.stringify({ error: "Error checking permissions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { articleId } = body;

    if (!articleId || typeof articleId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid article id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Article content is looked up server-side rather than trusted from the
    // client, same as the send-welcome-email/verify-email-token fixes.
    const { data: article, error: articleError } = await adminClient
      .from("articles")
      .select("title, content")
      .eq("id", articleId)
      .maybeSingle();

    if (articleError || !article) {
      return new Response(JSON.stringify({ error: "Article not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log("Generating quiz for article:", article.title, "requested by admin:", user.id);

    const systemPrompt = `Du är en expert på att skapa reflekterande quizfrågor för par som vill förstå klimakteriet bättre.

Skapa 3 reflekterande frågor baserat på artikeln. Varje fråga ska:
- Hjälpa partnern förstå hur hen kan stötta bättre
- Vara empatisk och respektfull
- Ha 4 svarsalternativ där ett är "bäst" (mest empatiskt/stöttande)
- Fokusera på praktiska situationer från artikeln

VIKTIGT FÖR SVARSALTERNATIV:
- Alla 4 svarsalternativ ska ha UNGEFÄR SAMMA LÄNGD (5-20 ord var)
- Positionen på det korrekta svaret måste variera
- Gör alla alternativ realistiska och trovärdiga

Svara ENDAST med giltig JSON i exakt detta format:
{
  "questions": [
    {
      "question": "Frågan här",
      "options": ["Alternativ A", "Alternativ B", "Alternativ C", "Alternativ D"],
      "correctIndex": x,
      "explanation": "Kort förklaring varför detta svar är bäst"
    }
  ]
}`;

    // Gemini returns 503/UNAVAILABLE fairly often when the model is under
    // heavy load ("high demand" - Google's own wording, not a real outage).
    // That's transient, so it's worth a couple of retries with backoff rather
    // than failing immediately. Each attempt gets its own timeout so one slow
    // response can't burn the entire retry budget.
    const GEMINI_TIMEOUT_MS = 20_000;
    const GEMINI_MAX_ATTEMPTS = 3;
    const GEMINI_BACKOFF_MS = [1000, 3000];

    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Artikel: "${article.title}"\n\nInnehåll:\n${article.content.substring(0, 3000)}`,
            },
          ],
        },
      ],
    });

    let response: Response | null = null;
    let lastErrorStatus = 0;
    let lastErrorText = "";

    for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

      try {
        response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
          {
            method: "POST",
            headers: {
              "x-goog-api-key": GEMINI_API_KEY,
              "Content-Type": "application/json",
            },
            body: requestBody,
            signal: controller.signal,
          }
        );
      } catch (fetchError) {
        response = null;
        lastErrorStatus = 0;
        lastErrorText = fetchError instanceof Error ? fetchError.message : String(fetchError);
      } finally {
        clearTimeout(timeout);
      }

      if (response?.ok) break;

      if (response) {
        lastErrorStatus = response.status;
        lastErrorText = await response.text();

        // Only retry on transient overload - not on rate limits, auth
        // errors, or bad requests, which won't be fixed by trying again.
        if (response.status !== 503) break;
      }

      console.error(`Gemini API attempt ${attempt}/${GEMINI_MAX_ATTEMPTS} failed:`, lastErrorStatus, lastErrorText);

      if (attempt < GEMINI_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, GEMINI_BACKOFF_MS[attempt - 1]));
      }
    }

    if (!response?.ok) {
      console.error("Gemini API error after retries:", lastErrorStatus, lastErrorText);

      if (lastErrorStatus === 429) {
        return new Response(JSON.stringify({ error: "För många förfrågningar, vänta en stund." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (lastErrorStatus === 402) {
        return new Response(JSON.stringify({ error: "Krediter slut, kontakta support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (lastErrorStatus === 503 || lastErrorStatus === 0) {
        return new Response(
          JSON.stringify({ error: "Quiz-tjänsten är överbelastad just nu. Försök igen om en liten stund." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Gemini API error: ${lastErrorStatus}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log("Raw AI response:", content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse quiz from AI response");
    }

    const quiz = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(quiz), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating quiz:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
