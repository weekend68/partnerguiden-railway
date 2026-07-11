import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = Deno.env.get("BASE_URL") || "https://partnerguiden.se";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const redirectTo = url.searchParams.get("redirect_to") || "/";

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token saknas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up the token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("email_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token lookup error:", tokenError);
      return Response.redirect(
        `${BASE_URL}/auth?error=invalid_token`,
        302
      );
    }

    // Check if token has expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return Response.redirect(
        `${BASE_URL}/auth?error=expired_token`,
        302
      );
    }

    // Get user email for magic link generation
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(tokenData.user_id);

    if (userError || !userData.user) {
      console.error("User lookup error:", userError);
      return Response.redirect(
        `${BASE_URL}/auth?error=user_not_found`,
        302
      );
    }

    // Generate a fresh magic link for the user (this one is single-use but that's fine)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email!,
      options: {
        redirectTo: `${BASE_URL}${redirectTo}`,
      },
    });

    if (linkError || !linkData) {
      console.error("Magic link generation error:", linkError);
      return Response.redirect(
        `${BASE_URL}/auth?error=link_failed`,
        302
      );
    }

    // Redirect to the Supabase verify URL which will log the user in
    const verifyUrl = linkData.properties?.action_link;
    if (!verifyUrl) {
      return Response.redirect(
        `${BASE_URL}/auth?error=link_failed`,
        302
      );
    }

    return Response.redirect(verifyUrl, 302);

  } catch (error: unknown) {
    console.error("Error in verify-email-token:", error);
    const message = error instanceof Error ? error.message : "Ett oväntat fel uppstod";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
