import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = Deno.env.get("BASE_URL") || "https://partnerguiden.se";

// HMAC-SHA256 signing for secure tokens
async function generateHMAC(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifyHMAC(message: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await generateHMAC(message, secret);
  return signature === expectedSignature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("id");
    const expiry = url.searchParams.get("exp");

    console.log(`Unsubscribe request: userId=${userId}, expiry=${expiry}`);

    // Validate required parameters
    if (!token || !userId || !expiry) {
      console.log("Missing required parameters");
      const redirectUrl = new URL("/avregistrera", BASE_URL);
      redirectUrl.searchParams.set("status", "error");
      redirectUrl.searchParams.set("reason", "missing_params");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Check expiry
    const expiryTimestamp = parseInt(expiry, 10);
    if (isNaN(expiryTimestamp) || Date.now() > expiryTimestamp) {
      console.log(`Token expired: ${new Date(expiryTimestamp).toISOString()}`);
      const redirectUrl = new URL("/avregistrera", BASE_URL);
      redirectUrl.searchParams.set("status", "error");
      redirectUrl.searchParams.set("reason", "expired");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Get the secret for HMAC verification
    const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SECRET");
    if (!unsubscribeSecret) {
      console.error("UNSUBSCRIBE_SECRET not configured");
      const redirectUrl = new URL("/avregistrera", BASE_URL);
      redirectUrl.searchParams.set("status", "error");
      redirectUrl.searchParams.set("reason", "server_error");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Verify HMAC signature
    const message = `${userId}:${expiry}`;
    const isValid = await verifyHMAC(message, token, unsubscribeSecret);

    if (!isValid) {
      console.log("Invalid HMAC signature");
      const redirectUrl = new URL("/avregistrera", BASE_URL);
      redirectUrl.searchParams.set("status", "error");
      redirectUrl.searchParams.set("reason", "invalid_token");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update user preferences
    const { data, error } = await supabase
      .from("user_preferences")
      .update({ email_enabled: false })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating preferences:", error);
      const redirectUrl = new URL("/avregistrera", BASE_URL);
      redirectUrl.searchParams.set("status", "error");
      redirectUrl.searchParams.set("reason", "update_failed");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    console.log(`Successfully unsubscribed user ${userId}`);

    const redirectUrl = new URL("/avregistrera", BASE_URL);
    redirectUrl.searchParams.set("status", "success");
    return Response.redirect(redirectUrl.toString(), 302);

  } catch (error: any) {
    console.error("Unsubscribe error:", error);
    const redirectUrl = new URL("/avregistrera", BASE_URL);
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set("reason", "unexpected");
    return Response.redirect(redirectUrl.toString(), 302);
  }
});
