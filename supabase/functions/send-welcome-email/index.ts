import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateHMAC } from "../_shared/hmac.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = Deno.env.get("BASE_URL") || "https://partnerguiden.se";

// Escape user-supplied text before interpolating into HTML emails.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// listUsers() defaults to a single page of 50 users. Past that many total
// users, a naive single call misses anyone not on page 1 - verified live
// against this project with a small per_page that older users don't
// return on page 1. Walk pages until a short page confirms the end.
async function findUserByEmail(
  supabase: any,
  email: string
) {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return { user: null, error };

    const match = data.users.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return { user: match, error: null };

    if (data.users.length < perPage) return { user: null, error: null };
    page++;
  }
}

// Send admin notification about new registration
async function sendAdminNotification(
  supabase: any,
  resend: any,
  newUserEmail: string,
  newUserName: string
) {
  try {
    // Get admin user IDs from user_roles
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError || !adminRoles?.length) {
      console.log("No admins found or error:", rolesError);
      return;
    }

    // Get admin emails from auth.users
    for (const adminRole of adminRoles) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
        adminRole.user_id
      );

      if (userError || !userData?.user?.email) {
        console.log("Could not get admin email:", userError);
        continue;
      }

      const adminEmail = userData.user.email;
      console.log(`Sending admin notification to ${adminEmail}`);

      await resend.emails.send({
        from: "Partnerguiden: Klimakteriet <noreply@partnerguiden.se>",
        to: [adminEmail],
        subject: "🆕 Ny användare registrerad",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f4f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4f0; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #8B7355 0%, #A0876B 100%); padding: 25px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">🆕 Ny registrering</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 15px 0; color: #4A4A4A; font-size: 16px;">
                En ny användare har registrerat sig på Partnerguiden:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4f0; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px 0; color: #6B5B4F; font-size: 14px;">
                      <strong>Namn:</strong> ${escapeHtml(newUserName || "Ej angivet")}
                    </p>
                    <p style="margin: 0; color: #6B5B4F; font-size: 14px;">
                      <strong>E-post:</strong> ${escapeHtml(newUserEmail)}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0 0; color: #888; font-size: 13px; text-align: center;">
                Registrerad ${new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f4f0; padding: 20px; text-align: center; border-top: 1px solid #e8e0d8;">
              <p style="margin: 0; color: #888; font-size: 12px;">
                Admin-notifikation från Partnerguiden: Klimakteriet
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      });
      console.log(`Admin notification sent to ${adminEmail}`);
    }
  } catch (error) {
    console.error("Error sending admin notification:", error);
    // Don't throw - admin notification failure shouldn't break welcome email
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SECRET")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // This function can be called by a database webhook or manually
    const { email, display_name } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve user_id server-side from the email instead of trusting a
    // caller-supplied user_id directly - accepting an arbitrary user_id from
    // an unauthenticated request would let anyone mint a valid signed
    // unsubscribe token for any account (see security review finding).
    const { user: matchedUser, error: listError } = await findUserByEmail(supabase, email);

    if (listError || !matchedUser) {
      return new Response(
        JSON.stringify({ error: "No user found for that email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user_id = matchedUser.id;
    const name = display_name || "du";

    // Generate unsubscribe link with HMAC signature
    const expiry = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year
    const message = `${user_id}:${expiry}`;
    const token = await generateHMAC(message, unsubscribeSecret);
    const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${encodeURIComponent(token)}&id=${user_id}&exp=${expiry}`;

    console.log(`Sending welcome email to ${email} (user: ${user_id})`);

    const emailResult = await resend.emails.send({
      from: "Partnerguiden: Klimakteriet <noreply@partnerguiden.se>",
      to: [email],
      subject: "🎉 Välkommen till Partnerguiden!",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f4f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4f0; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8B7355 0%, #A0876B 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🎉 Välkommen!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #6B5B4F; font-size: 18px;">Hej ${escapeHtml(name)}! 👋</p>
              
              <p style="margin: 0 0 20px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Tack för att du registrerade dig på <strong>Partnerguiden: Klimakteriet</strong>. 
                Du har tagit ett viktigt steg för att bli en bättre partner.
              </p>
              
              <p style="margin: 0 0 25px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                <strong>Så här fungerar det:</strong>
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td style="padding: 15px; background-color: #f8f4f0; border-radius: 8px; margin-bottom: 10px;">
                    <p style="margin: 0; color: #4A4A4A; font-size: 15px;">
                      📬 <strong>Dagligt mail</strong> – Du får ett mail varje dag kl 18:00 med nästa artikel
                    </p>
                  </td>
                </tr>
                <tr><td style="height: 10px;"></td></tr>
                <tr>
                  <td style="padding: 15px; background-color: #f8f4f0; border-radius: 8px; margin-bottom: 10px;">
                    <p style="margin: 0; color: #4A4A4A; font-size: 15px;">
                      🔑 <strong>Inga lösenord</strong> – Du loggar in via länk i mejlet, enkelt och säkert
                    </p>
                  </td>
                </tr>
                <tr><td style="height: 10px;"></td></tr>
                <tr>
                  <td style="padding: 15px; background-color: #f8f4f0; border-radius: 8px; margin-bottom: 10px;">
                    <p style="margin: 0; color: #4A4A4A; font-size: 15px;">
                      📊 <strong>Följ framstegen</strong> – Se hur långt du kommit i kursen
                    </p>
                  </td>
                </tr>
                <tr><td style="height: 10px;"></td></tr>
                <tr>
                  <td style="padding: 15px; background-color: #f8f4f0; border-radius: 8px;">
                    <p style="margin: 0; color: #4A4A4A; font-size: 15px;">
                      🎓 <strong>Diplom</strong> – När du klarat alla quiz får du ett diplom
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 25px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Ditt första mail kommer imorgon klockan 18:00. Fram tills dess kan du börja läsa direkt på sajten!
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${BASE_URL}/artiklar" style="display: inline-block; background: linear-gradient(135deg, #8B7355 0%, #6B5B4F 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(139, 115, 85, 0.3);">
                      Börja läsa första artikeln →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #888; font-size: 14px; text-align: center; line-height: 1.5;">
                Tack för att du vill lära dig mer. Tillsammans gör ni det bättre. 💛
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f4f0; padding: 25px 30px; text-align: center; border-top: 1px solid #e8e0d8;">
              <p style="margin: 0; color: #888; font-size: 12px;">
                © ${new Date().getFullYear()} Partnerguiden: Klimakteriet
              </p>
              <p style="margin: 10px 0 0 0; color: #aaa; font-size: 11px;">
                Du får detta mail för att du precis skapade ett konto på partnerguiden.se
              </p>
              <p style="margin: 10px 0 0 0;">
                <a href="${unsubscribeUrl}" style="color: #aaa; font-size: 11px; text-decoration: underline;">
                  Avregistrera dig från dagliga mail
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    console.log("Welcome email sent successfully:", emailResult);

    // Send admin notification (async, don't wait)
    await sendAdminNotification(supabase, resend, email, name);

    return new Response(
      JSON.stringify({ success: true, result: emailResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
