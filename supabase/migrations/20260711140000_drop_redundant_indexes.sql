-- idx_articles_slug and idx_email_tokens_token duplicate the indexes Postgres
-- already created to enforce the UNIQUE constraints on these columns
-- (articles_slug_key, email_tokens_token_key) - same column, same btree type,
-- no partial/expression difference. Redundant write overhead with zero query
-- benefit; confirmed live via pg_indexes before dropping.
DROP INDEX IF EXISTS public.idx_articles_slug;
DROP INDEX IF EXISTS public.idx_email_tokens_token;
