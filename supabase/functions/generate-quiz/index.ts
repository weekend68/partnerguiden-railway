import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting per IP (resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10; // Max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("cf-connecting-ip") 
      || req.headers.get("x-real-ip")
      || "unknown";
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      console.log("Rate limited IP:", clientIP);
      return new Response(
        JSON.stringify({ error: "För många förfrågningar. Vänta en stund och försök igen." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { articleTitle, articleContent } = body;

    // Input validation
    if (!articleTitle || typeof articleTitle !== "string") {
      return new Response(JSON.stringify({ error: "Invalid article title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!articleContent || typeof articleContent !== "string") {
      return new Response(JSON.stringify({ error: "Invalid article content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce reasonable length limits to prevent resource exhaustion
    if (articleTitle.length > 200) {
      return new Response(JSON.stringify({ error: "Article title too long (max 200 characters)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (articleContent.length > 50000) {
      return new Response(JSON.stringify({ error: "Article content too long (max 50000 characters)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log("Generating quiz for article:", articleTitle, "from IP:", clientIP);

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

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Artikel: "${articleTitle}"\n\nInnehåll:\n${articleContent.substring(0, 3000)}`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "För många förfrågningar, vänta en stund." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Krediter slut, kontakta support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log("Raw AI response:", content);

    // Parse the JSON from the response
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
