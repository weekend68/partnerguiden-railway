import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-admin-test",
};

const BASE_URL = Deno.env.get("BASE_URL") || "https://partnerguiden.se";

// Image base URL - images need to be in public/images folder
const IMAGE_BASE_URL = `${BASE_URL}/images`;

interface ArticleData {
  slug: string;
  title: string;
  excerpt: string;
  image_filename: string;
  sort_order: number;
}

// HMAC-SHA256 signing for secure unsubscribe tokens
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

// Helper to generate email content based on progress
function getProgressMessage(articleIndex: number, isLastArticle: boolean, totalArticles: number, displayName: string): string {
  if (articleIndex === 0) {
    return "Välkommen till din första artikel! 🎉";
  }
  if (isLastArticle) {
    return `🎊 Grattis ${displayName}! Du har nått sista artikeln i serien – dag ${articleIndex + 1} av ${totalArticles}. Det här är en fantastisk prestation!`;
  }
  return `Fantastiskt att du fortsätter! Du är nu på dag ${articleIndex + 1} av ${totalArticles}. 💪`;
}

function getFooterMessage(articleIndex: number, isLastArticle: boolean): string {
  if (isLastArticle) {
    return "🌟 Detta är det sista mejlet i serien. Tack för att du följt med hela vägen! Du kan alltid gå tillbaka och läsa artiklarna igen på Partnerguiden.";
  }
  if (articleIndex < 6) {
    return "Varje artikel ger er nya verktyg att navigera tillsammans.";
  }
  return "Du har redan lärt dig så mycket! Fortsätt den goda trenden. 🌟";
}

// Calculate which article should be sent based on journey_start_date
function calculateArticleIndexForToday(journeyStartDate: string): number {
  const start = new Date(journeyStartDate);
  const today = new Date();
  
  // Reset time to midnight for both dates to count full days
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  // Calculate days since journey started (0 = first day = article 0)
  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysSinceStart;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SECRET");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check authorization method
    const isAdminTest = req.headers.get("x-admin-test") === "true";
    const providedCronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    
    // Check if authorized via service role key (for cron jobs from pg_net)
    const isServiceRoleAuth = authHeader?.includes(supabaseServiceKey);

    // If NOT admin test, require cron secret OR service role key (for scheduled jobs)
    if (!isAdminTest) {
      let authorized = false;
      
      // Method 1: Service role key in Authorization header (for pg_net cron calls)
      if (isServiceRoleAuth) {
        console.log("Cron job authorized via service role key");
        authorized = true;
      }
      
      // Method 2: CRON_SECRET header (legacy/fallback)
      if (!authorized && cronSecret && providedCronSecret === cronSecret) {
        console.log("Cron job authorized via cron secret");
        authorized = true;
      }
      
      if (!authorized) {
        console.log("Unauthorized: Invalid or missing cron secret/service role key");
        return new Response(
          JSON.stringify({ error: "Unauthorized - Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // If admin test mode, require authentication and verify admin role BEFORE any processing
    if (isAdminTest) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        console.log("Admin test mode requires authentication");
        return new Response(
          JSON.stringify({ error: "Unauthorized - Authentication required for admin test" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create user client to verify the JWT
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

      if (claimsError || !claimsData?.claims) {
        console.log("Invalid or expired token");
        return new Response(
          JSON.stringify({ error: "Unauthorized - Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = claimsData.claims.sub;

      // Verify user is admin using service role client
      const { data: adminRole, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .single();

      if (roleError || !adminRole) {
        console.log(`User ${userId} is not an admin`);
        return new Response(
          JSON.stringify({ error: "Forbidden - Admin role required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Admin test authorized for user ${userId}`);
    }
    
    console.log(`Running email job. Admin test: ${isAdminTest}`);

    // Fetch articles from database (sorted by sort_order)
    const { data: articlesData, error: articlesError } = await supabase
      .from("articles")
      .select("slug, title, excerpt, image_filename, sort_order")
      .order("sort_order", { ascending: true });

    if (articlesError) {
      console.error("Error fetching articles:", articlesError);
      throw articlesError;
    }

    if (!articlesData || articlesData.length === 0) {
      console.log("No articles found in database");
      return new Response(JSON.stringify({ message: "No articles in database" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ARTICLE_SEQUENCE: ArticleData[] = articlesData;
    const TOTAL_ARTICLES = ARTICLE_SEQUENCE.length;

    console.log(`Loaded ${TOTAL_ARTICLES} articles from database`);

    // Get users who should receive emails
    let usersQuery = supabase
      .from("user_preferences")
      .select("user_id, email_frequency, journey_start_date, email_enabled")
      .eq("email_enabled", true);

    const { data: preferences, error: prefError } = await usersQuery;

    if (prefError) {
      console.error("Error fetching preferences:", prefError);
      throw prefError;
    }

    if (!preferences || preferences.length === 0) {
      console.log("No users with email preferences found");
      return new Response(JSON.stringify({ message: "No users to email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailsSent = 0;
    let emailsSkipped = 0;

    for (const pref of preferences) {
      try {
        // In admin test mode, only send to admins
        if (isAdminTest) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", pref.user_id)
            .eq("role", "admin")
            .single();

          if (!roles) {
            console.log(`Skipping user ${pref.user_id} - not admin (admin test mode)`);
            continue;
          }
        }

        // Calculate which article should be sent today based on journey_start_date
        if (!pref.journey_start_date) {
          console.log(`User ${pref.user_id} has no journey_start_date, skipping`);
          continue;
        }

        const expectedArticleIndex = calculateArticleIndexForToday(pref.journey_start_date);
        console.log(`User ${pref.user_id}: journey started ${pref.journey_start_date}, expected article index: ${expectedArticleIndex}`);

        // Check if all articles have been sent (journey complete)
        if (expectedArticleIndex >= TOTAL_ARTICLES) {
          console.log(`User ${pref.user_id} has completed the journey (day ${expectedArticleIndex + 1})`);
          continue;
        }

        // Get user's email from auth
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(pref.user_id);
        
        if (userError || !userData.user?.email) {
          console.error(`Could not get email for user ${pref.user_id}:`, userError);
          continue;
        }

        const userEmail = userData.user.email;
        const displayName = userData.user.user_metadata?.display_name || "du";

        const article = ARTICLE_SEQUENCE[expectedArticleIndex];
        const isLastArticle = expectedArticleIndex === TOTAL_ARTICLES - 1;
        
        // Generate or get existing long-lived token for this user
        const redirectPath = `/artikel/${article.slug}`;
        
        // Check if user already has a valid token
        const { data: existingToken } = await supabase
          .from("email_tokens")
          .select("token, expires_at")
          .eq("user_id", pref.user_id)
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1)
          .single();

        let emailToken: string;
        
        if (existingToken) {
          emailToken = existingToken.token;
          console.log(`Using existing token for user ${pref.user_id}`);
        } else {
          // Generate new token (valid for 14 days)
          emailToken = crypto.randomUUID() + "-" + crypto.randomUUID();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 14);
          
          const { error: tokenError } = await supabase
            .from("email_tokens")
            .insert({
              user_id: pref.user_id,
              token: emailToken,
              expires_at: expiresAt.toISOString(),
            });

          if (tokenError) {
            console.error(`Error creating token for ${pref.user_id}:`, tokenError);
            continue;
          }
          console.log(`Created new 14-day token for user ${pref.user_id}`);
        }

        // Create the long-lived login link using our custom verify function
        const magicLink = `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-email-token?token=${emailToken}&redirect_to=${encodeURIComponent(redirectPath)}`;
        console.log(`Generated long-lived link for article ${expectedArticleIndex}: ${magicLink}`);

        // Generate signed unsubscribe link (valid for 90 days)
        let unsubscribeLink = `${BASE_URL}/avregistrera`;
        if (unsubscribeSecret) {
          const unsubExpiry = Date.now() + (90 * 24 * 60 * 60 * 1000); // 90 days
          const unsubMessage = `${pref.user_id}:${unsubExpiry}`;
          const unsubToken = await generateHMAC(unsubMessage, unsubscribeSecret);
          unsubscribeLink = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe?token=${encodeURIComponent(unsubToken)}&id=${pref.user_id}&exp=${unsubExpiry}`;
        }

        // Generate dynamic content based on progress
        const progressMessage = getProgressMessage(expectedArticleIndex, isLastArticle, TOTAL_ARTICLES, displayName);
        const footerMessage = getFooterMessage(expectedArticleIndex, isLastArticle);
        const subjectPrefix = isLastArticle ? "🎊" : "📖";
        const subjectSuffix = isLastArticle ? " (Sista artikeln!)" : "";

        // Atomically reserve this (user, article) slot BEFORE calling Resend.
        // UNIQUE(user_id, article_slug) makes this INSERT itself the lock: if
        // pg_cron double-fires or an admin-test run overlaps the scheduled
        // one, only one concurrent invocation's INSERT can succeed - the
        // other gets a 23505 conflict here and skips, before ever reaching
        // the Resend call. Previously the "already sent" check was a plain
        // SELECT read long before the eventual log INSERT, with the Resend
        // send itself in the gap - both invocations could pass the check
        // and both actually send the email.
        const { error: reserveError } = await supabase.from("email_log").insert({
          user_id: pref.user_id,
          article_slug: article.slug,
          article_index: expectedArticleIndex,
          status: "sent", // optimistic; corrected to 'failed' below if Resend actually errors
        });

        if (reserveError) {
          if (reserveError.code === "23505") {
            console.log(`User ${pref.user_id} already has a log entry for article ${expectedArticleIndex}, skipping`);
            emailsSkipped++;
          } else {
            console.error(`Error reserving email log for ${pref.user_id}:`, reserveError);
          }
          continue;
        }

        // Send email with Duolingo-style encouraging tone
        console.log(`Attempting to send email to ${userEmail} for article ${expectedArticleIndex}...`);

        const emailResult = await resend.emails.send({
          from: "Partnerguiden: Klimakteriet <noreply@partnerguiden.se>",
          to: [userEmail],
          subject: `${subjectPrefix} Dag ${expectedArticleIndex + 1}: ${article.title}${subjectSuffix}`,
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
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Partnerguiden: Klimakteriet</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Din resa genom klimakteriet – tillsammans</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #6B5B4F; font-size: 16px;">Hej ${displayName}! 👋</p>
              
              <p style="margin: 0 0 25px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                ${progressMessage}
              </p>
              
              <!-- Article Card with Image -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4f0; border-radius: 12px; overflow: hidden; margin-bottom: 25px;">
                <tr>
                  <td>
                    <img src="${IMAGE_BASE_URL}/${article.image_filename}" alt="${article.title}" style="width: 100%; height: auto; display: block;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding: 25px;">
                    <p style="margin: 0 0 5px 0; color: #8B7355; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${isLastArticle ? "Sista artikeln" : `Dag ${expectedArticleIndex + 1}`}</p>
                    <h2 style="margin: 0 0 15px 0; color: #2D2D2D; font-size: 22px; font-weight: 600;">${article.title}</h2>
                    <p style="margin: 0; color: #6B5B4F; font-size: 15px; line-height: 1.5;">${article.excerpt}</p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #8B7355 0%, #6B5B4F 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(139, 115, 85, 0.3);">
                      ${isLastArticle ? "Läs sista artikeln →" : "Läs dagens artikel →"}
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #888; font-size: 14px; text-align: center; line-height: 1.5;">
                ${footerMessage}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f4f0; padding: 25px 30px; text-align: center; border-top: 1px solid #e8e0d8;">
              <p style="margin: 0 0 10px 0; color: #888; font-size: 12px;">
                Du får detta mejl för att du har registrerat dig på Partnerguiden.
              </p>
              <p style="margin: 0; color: #888; font-size: 12px;">
                <a href="${unsubscribeLink}" style="color: #8B7355; text-decoration: underline;">Avsluta prenumeration</a>
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

        // Check for Resend API errors
        if (emailResult.error) {
          console.error(`Resend API error for ${userEmail}:`, emailResult.error);

          // Correct the optimistic 'sent' reservation to reflect the real outcome.
          await supabase
            .from("email_log")
            .update({
              status: "failed",
              error_message: emailResult.error.message || JSON.stringify(emailResult.error),
            })
            .eq("user_id", pref.user_id)
            .eq("article_slug", article.slug);

          continue;
        }

        console.log(`Email sent successfully to ${userEmail} (article ${expectedArticleIndex}):`, emailResult);

        // Already logged as 'sent' by the reservation insert above - nothing more to do.
        emailsSent++;
      } catch (userError) {
        console.error(`Error processing user ${pref.user_id}:`, userError);
      }
    }

    console.log(`Email job completed. Sent: ${emailsSent}, Skipped: ${emailsSkipped}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        emailsSkipped,
        totalUsers: preferences.length 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-daily-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
