-- Remove only profile extensions and role columns that are superseded by
-- profiles.role. Movies, schedules, seat inventory, bookings and ticket history
-- remain in the core relational schema.

DO $$
DECLARE
  relation_name TEXT;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'normal_users_section',
    'movie_providers_section',
    'movie_provider_films_section',
    'movie_providers_with_films'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = relation_name AND c.relkind = 'v'
    ) THEN
      EXECUTE format('DROP VIEW public.%I', relation_name);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_sync_profile_types ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_types();
DROP FUNCTION IF EXISTS public.trg_movie_provider_films_section_dml();

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS provider_type,
  DROP COLUMN IF EXISTS user_type;

DROP TABLE IF EXISTS public.customer_profiles;
DROP TABLE IF EXISTS public.cinema_owner_profiles;
DROP TABLE IF EXISTS public.movie_provider_profiles;
DROP TABLE IF EXISTS public.admin_profiles;

-- Keep the baseline single-column show indexes and remove accidental duplicates.
DROP INDEX IF EXISTS public.idx_shows_movie_id;
DROP INDEX IF EXISTS public.idx_shows_show_date;
