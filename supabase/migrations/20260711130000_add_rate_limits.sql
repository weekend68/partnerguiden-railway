-- Persistent, atomic rate limiting for public edge functions.
-- Replaces in-memory per-isolate Maps (generate-quiz, send-magic-link),
-- which do not share state reliably across Supabase Edge Function
-- invocations and were verified live to not actually limit anything.

create table public.rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

-- Only the service role (used exclusively by edge functions) touches this
-- table; deny all access via the normal anon/authenticated roles.
create policy "Deny all access to rate_limits"
  on public.rate_limits
  for all
  using (false)
  with check (false);

-- Atomically check-and-increment a rate limit counter for `p_key`.
-- Returns true if the request is allowed (under `p_limit` within the
-- current `p_window_seconds` window), false if it should be rejected.
-- The INSERT ... ON CONFLICT DO UPDATE is a single statement, so Postgres
-- serializes concurrent calls for the same key via the row's own lock -
-- no separate read-then-write race like the in-memory version had.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
        then 1
      else public.rate_limits.count + 1
    end,
    window_start = case
      when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
        then now()
      else public.rate_limits.window_start
    end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Periodic cleanup is not automated (no pg_cron entry) since this table
-- stays tiny (one row per distinct rate-limited key, e.g. per IP) for a
-- low-traffic site - revisit if key cardinality grows significantly.
