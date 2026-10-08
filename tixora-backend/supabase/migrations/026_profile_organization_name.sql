-- Store the cinema/provider organization name entered during registration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);

-- Keep previously registered cinema names visible on their owner profiles.
UPDATE public.profiles AS profile
SET organization_name = cinema.cinema_name
FROM public.cinemas AS cinema
WHERE cinema.owner_user_id = profile.id
  AND profile.organization_name IS NULL;
