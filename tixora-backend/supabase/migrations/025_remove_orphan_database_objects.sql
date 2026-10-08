-- Remove leftovers from the abandoned database-section view and duplicate indexes.
DROP FUNCTION IF EXISTS public.trg_movie_provider_films_section_dml();
DROP INDEX IF EXISTS public.idx_shows_movie_id;
DROP INDEX IF EXISTS public.idx_shows_show_date;
