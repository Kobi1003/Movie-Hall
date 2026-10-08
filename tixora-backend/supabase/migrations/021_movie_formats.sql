-- Preserve the provider-selected exhibition formats with the submitted movie.
ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS formats TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
