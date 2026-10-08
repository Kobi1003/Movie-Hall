-- Keep provider ownership and show scheduling in the normalized core tables.
-- The dashboard groups records in the API; database views and duplicate role
-- columns are not needed for those UI sections.

ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS default_start_time TIME,
  ADD COLUMN IF NOT EXISTS formats TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_movies_created_by_provider
  ON public.movies(created_by_provider);

CREATE INDEX IF NOT EXISTS idx_shows_movie_date
  ON public.shows(movie_id, show_date);
