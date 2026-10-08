-- Store the partner's preferred default showtime with film metadata.
-- Actual scheduled screenings continue to store their own start_time in shows.
ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS default_start_time TIME;
