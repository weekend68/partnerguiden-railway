import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const RATE_LIMIT_MAX = 5; // Max requests per window
const RATE_LIMIT_WINDOW_SECONDS = 60;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || "unknown";

    const { data: allowed, error: rateLimitError } = await supabase.rpc("check_rate_limit", {
      p_key: `send-magic-link:${clientIP}`,
      p_limit: RATE_LIMIT_MAX,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (rateLimitError) {
      // Fail open on infra errors rather than blocking all logins if the
      // rate_limits table/function is ever unavailable.
      console.error("Rate limit check failed:", rateLimitError);
    } else if (!allowed) {
      console.log("Rate limited IP:", clientIP);
      return new Response(
        JSON.stringify({ error: "För många förfrågningar. Vänta en stund och försök igen." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, name, redirectTo } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "E-postadress saknas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof name === "string" && name.length > 200) {
      return new Response(
        JSON.stringify({ error: "Namnet är för långt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing magic link request for ${email}`);

    // Check if user exists
    const { user: foundUser, error: listError } = await findUserByEmail(supabase, email);
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Kunde inte slå upp användare" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let user = foundUser;
    let isNewUser = false;

    if (!user) {
      // Create new user
      console.log(`Creating new user for ${email}`);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: name || null }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Kunde inte skapa användare" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = newUser.user;
      isNewUser = true;
    }

    // Generate magic link using Supabase Admin API
    const finalRedirectTo = redirectTo || "/";
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
      options: {
        redirectTo: `${BASE_URL}${finalRedirectTo}`,
      },
    });

    if (linkError || !linkData) {
      console.error("Error generating magic link:", linkError);
      return new Response(
        JSON.stringify({ error: "Kunde inte skapa inloggningslänk" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const magicLinkUrl = linkData.properties?.action_link;
    if (!magicLinkUrl) {
      return new Response(
        JSON.stringify({ error: "Kunde inte skapa inloggningslänk" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending magic link email to ${email}`);

    // Send styled magic link email via Resend
    const emailResult = await resend.emails.send({
      from: "Partnerguiden: Klimakteriet <noreply@partnerguiden.se>",
      to: [email],
      subject: isNewUser ? "🎉 Välkommen till Partnerguiden!" : "🔑 Din inloggningslänk",
      html: isNewUser
        ? generateWelcomeWithLinkEmail(escapeHtml(name || "du"), magicLinkUrl)
        : generateMagicLinkEmail(escapeHtml(name || "du"), magicLinkUrl),
    });

    console.log("Magic link email sent:", emailResult);

    // For new users, also send admin notification
    if (isNewUser) {
      await sendAdminNotification(supabase, email, name || "Ej angivet");
    }

    return new Response(
      JSON.stringify({ success: true, isNewUser }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-magic-link:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Generate magic link email for existing users
function generateMagicLinkEmail(name: string, magicLinkUrl: string): string {
  return `
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
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 600;">🔑 Din inloggningslänk</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #6B5B4F; font-size: 18px;">Hej ${name}! 👋</p>
              
              <p style="margin: 0 0 25px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Klicka på knappen nedan för att logga in på Partnerguiden. 
                Ingen lösenord behövs – det är enkelt och säkert!
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td align="center">
                    <a href="${magicLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #8B7355 0%, #6B5B4F 100%); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 30px; font-size: 17px; font-weight: 600; box-shadow: 0 4px 15px rgba(139, 115, 85, 0.3);">
                      Logga in nu →
                    </a>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4f0; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 15px;">
                    <p style="margin: 0; color: #888; font-size: 13px; text-align: center;">
                      ⏰ Länken är giltig i 1 timme
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #888; font-size: 13px; line-height: 1.5;">
                Om knappen inte fungerar, kopiera och klistra in denna länk i din webbläsare:
              </p>
              <p style="margin: 10px 0 0 0; word-break: break-all; color: #8B7355; font-size: 12px;">
                ${magicLinkUrl}
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
                Du får detta mail för att någon försökte logga in med din e-postadress på partnerguiden.se
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Generate welcome email with magic link for new users
function generateWelcomeWithLinkEmail(name: string, magicLinkUrl: string): string {
  return `
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
              <p style="margin: 0 0 20px 0; color: #6B5B4F; font-size: 18px;">Hej ${name}! 👋</p>
              
              <p style="margin: 0 0 20px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Tack för att du registrerade dig på <strong>Partnerguiden: Klimakteriet</strong>. 
                Du har tagit ett viktigt steg för att bli en bättre partner.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td align="center">
                    <a href="${magicLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #8B7355 0%, #6B5B4F 100%); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 30px; font-size: 17px; font-weight: 600; box-shadow: 0 4px 15px rgba(139, 115, 85, 0.3);">
                      Logga in och börja läsa →
                    </a>
                  </td>
                </tr>
              </table>
              
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
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4f0; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 15px;">
                    <p style="margin: 0; color: #888; font-size: 13px; text-align: center;">
                      ⏰ Inloggningslänken ovan är giltig i 1 timme
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #888; font-size: 14px; text-align: center; line-height: 1.5;">
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
                Du får detta mail för att du precis registrerade dig på partnerguiden.se
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Send admin notification
async function sendAdminNotification(
  supabase: any,
  newUserEmail: string,
  newUserName: string
) {
  try {
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError || !adminRoles?.length) {
      console.log("No admins found or error:", rolesError);
      return;
    }

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
                      <strong>Namn:</strong> ${escapeHtml(newUserName)}
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
  }
}
