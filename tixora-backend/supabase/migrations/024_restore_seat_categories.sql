-- Seat categories are required by seat-plan editing, live seat maps and show
-- inventory pricing. Restore the table and recover the category identifiers
-- still referenced by the existing 256 seat rows.
CREATE TABLE IF NOT EXISTS public.seat_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_plan_version_id UUID NOT NULL REFERENCES public.seat_plan_versions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  seat_type public.seat_type_enum NOT NULL DEFAULT 'STANDARD',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH type_counts AS (
  SELECT seat_plan_version_id, category_id, seat_type::TEXT AS seat_type, COUNT(*) AS seats
  FROM public.seats
  GROUP BY seat_plan_version_id, category_id, seat_type
), dominant_types AS (
  SELECT DISTINCT ON (seat_plan_version_id, category_id)
    seat_plan_version_id, category_id, seat_type
  FROM type_counts
  ORDER BY seat_plan_version_id, category_id, seats DESC, seat_type
)
INSERT INTO public.seat_categories (
  id, seat_plan_version_id, name, display_name, base_price, currency, seat_type
)
SELECT
  category_id,
  seat_plan_version_id,
  CASE seat_type
    WHEN 'RECLINER' THEN 'recliner'
    WHEN 'VIP' THEN 'vip'
    WHEN 'PREMIUM' THEN 'premium'
    ELSE 'classic'
  END,
  CASE seat_type
    WHEN 'RECLINER' THEN 'Recliner Lounge'
    WHEN 'VIP' THEN 'VIP Deluxe'
    WHEN 'PREMIUM' THEN 'Premium Gallery'
    ELSE 'Classic Stalls'
  END,
  CASE seat_type
    WHEN 'RECLINER' THEN 950
    WHEN 'VIP' THEN 650
    WHEN 'PREMIUM' THEN 500
    ELSE 350
  END,
  'INR',
  seat_type::public.seat_type_enum
FROM dominant_types
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.seats'::regclass AND conname = 'seats_category_id_fkey'
  ) THEN
    ALTER TABLE public.seats
      ADD CONSTRAINT seats_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.seat_categories(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_seat_categories_version
  ON public.seat_categories(seat_plan_version_id);
ALTER TABLE public.seat_categories ENABLE ROW LEVEL SECURITY;
