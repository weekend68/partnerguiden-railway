import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PostgREST silently caps unpaginated selects at the project's configured
// Max Rows setting (1000 for this project) with no error - past that many
// rows, a plain .select() just returns a truncated result. This walks
// `.range()` pages until a short page confirms we've reached the end, so
// these stats stay correct regardless of table size.
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<{ data: T[]; error: unknown }> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) return { data: allRows, error };
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { data: allRows, error: null };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify identity
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("User authentication failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

    // Use service role client to check admin status and fetch stats
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Error checking admin role:", roleError);
      return new Response(
        JSON.stringify({ error: "Error checking permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      console.error("User is not admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin verified, fetching stats...");

    // Fetch all stats using service role (bypasses RLS)
    
    // 1. Total registered users
    const { count: totalUsers, error: usersError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (usersError) {
      console.error("Error fetching users:", usersError);
    }

    // 2. All progress data with article info (use article_id, not article_slug)
    const { data: progressData, error: progressError } = await fetchAllRows((from, to) =>
      adminClient
        .from("user_progress")
        .select("user_id, article_id, article_read, quiz_completed, quiz_score")
        .range(from, to)
    );

    if (progressError) {
      console.error("Error fetching progress:", progressError);
    }

    // 3. Fetch articles to map article_id to slug
    const { data: articlesData, error: articlesError } = await adminClient
      .from("articles")
      .select("id, slug, title");

    if (articlesError) {
      console.error("Error fetching articles:", articlesError);
    }

    const articleMap = new Map<string, { slug: string; title: string }>();
    (articlesData || []).forEach(a => {
      articleMap.set(a.id, { slug: a.slug, title: a.title });
    });

    // Calculate stats
    const progress = progressData || [];
    
    // Unique users with any progress
    const usersWithProgress = new Set(progress.map(p => p.user_id)).size;
    
    // Users who completed all 13 articles and quizzes
    const userProgressMap = new Map<string, { articles: number; quizzes: number }>();
    progress.forEach(p => {
      const current = userProgressMap.get(p.user_id) || { articles: 0, quizzes: 0 };
      if (p.article_read) current.articles++;
      if (p.quiz_completed) current.quizzes++;
      userProgressMap.set(p.user_id, current);
    });

    const completedUsers = Array.from(userProgressMap.values())
      .filter(p => p.articles === 13 && p.quizzes === 13).length;

    // Completion rate
    const completionRate = usersWithProgress > 0 
      ? Math.round((completedUsers / usersWithProgress) * 100) 
      : 0;

    // Most read articles (using article_id mapped to slug)
    const articleReadCounts = new Map<string, number>();
    progress.forEach(p => {
      if (p.article_read) {
        const articleInfo = articleMap.get(p.article_id);
        const slug = articleInfo?.slug || p.article_id;
        articleReadCounts.set(slug, (articleReadCounts.get(slug) || 0) + 1);
      }
    });
    const mostReadArticles = Array.from(articleReadCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([slug, count]) => ({ slug, count }));

    // Quiz results per article
    const quizResults = new Map<string, { total: number; scores: number[] }>();
    progress.forEach(p => {
      if (p.quiz_completed && p.quiz_score !== null) {
        const articleInfo = articleMap.get(p.article_id);
        const slug = articleInfo?.slug || p.article_id;
        const current = quizResults.get(slug) || { total: 0, scores: [] };
        current.total++;
        current.scores.push(p.quiz_score);
        quizResults.set(slug, current);
      }
    });
    const quizStats = Array.from(quizResults.entries())
      .map(([slug, data]) => ({
        slug,
        completions: data.total,
        averageScore: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10,
      }))
      .sort((a, b) => b.completions - a.completions);

    // Average progress
    const avgArticlesRead = usersWithProgress > 0
      ? Math.round(Array.from(userProgressMap.values()).reduce((sum, p) => sum + p.articles, 0) / usersWithProgress * 10) / 10
      : 0;
    const avgQuizzesCompleted = usersWithProgress > 0
      ? Math.round(Array.from(userProgressMap.values()).reduce((sum, p) => sum + p.quizzes, 0) / usersWithProgress * 10) / 10
      : 0;

    // 4. User activity - signups per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentProfiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("created_at")
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (profilesError) {
      console.error("Error fetching recent profiles:", profilesError);
    }

    // Group signups by day
    const signupsByDay = new Map<string, number>();
    (recentProfiles || []).forEach(p => {
      const day = p.created_at.split("T")[0];
      signupsByDay.set(day, (signupsByDay.get(day) || 0) + 1);
    });

    const dailySignups = Array.from(signupsByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    // 5. User engagement - quiz activity per day (last 30 days)
    const { data: recentProgress, error: recentProgressError } = await fetchAllRows((from, to) =>
      adminClient
        .from("user_progress")
        .select("user_id, updated_at, quiz_completed")
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .eq("quiz_completed", true)
        .range(from, to)
    );

    if (recentProgressError) {
      console.error("Error fetching recent progress:", recentProgressError);
    }

    // Active users per day (users who completed a quiz)
    const activeUsersByDay = new Map<string, Set<string>>();
    (recentProgress || []).forEach(p => {
      const day = p.updated_at.split("T")[0];
      if (!activeUsersByDay.has(day)) {
        activeUsersByDay.set(day, new Set());
      }
      activeUsersByDay.get(day)!.add(p.user_id);
    });

    const dailyActiveUsers = Array.from(activeUsersByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, users]) => ({ date, count: users.size }));

    // 6. Top active users (most quizzes completed)
    const userQuizCounts = new Map<string, number>();
    progress.forEach(p => {
      if (p.quiz_completed) {
        userQuizCounts.set(p.user_id, (userQuizCounts.get(p.user_id) || 0) + 1);
      }
    });

    const topUserIds = Array.from(userQuizCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId]) => userId);

    const { data: topUserProfiles, error: topUserProfilesError } = await adminClient
      .from("profiles")
      .select("id, display_name")
      .in("id", topUserIds);

    if (topUserProfilesError) {
      console.error("Error fetching top user profiles:", topUserProfilesError);
    }

    const displayNameById = new Map<string, string>();
    (topUserProfiles || []).forEach(p => {
      if (p.display_name) displayNameById.set(p.id, p.display_name);
    });

    const topActiveUsers = topUserIds.map(userId => ({
      userId,
      displayName: displayNameById.get(userId) || `Användare ${userId.substring(0, 8)}`,
      quizzesCompleted: userQuizCounts.get(userId)!,
    }));

    const stats = {
      totalUsers: totalUsers || 0,
      usersWithProgress,
      completedUsers,
      completionRate,
      avgArticlesRead,
      avgQuizzesCompleted,
      mostReadArticles,
      quizStats,
      dailySignups,
      dailyActiveUsers,
      topActiveUsers,
    };

    console.log("Stats calculated successfully");

    return new Response(
      JSON.stringify(stats),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
