-- 008_shows.sql
CREATE TYPE show_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'SOLD_OUT', 'CANCELLED', 'COMPLETED', 'SUSPENDED');

CREATE TABLE IF NOT EXISTS shows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE RESTRICT,
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE RESTRICT,
    authorization_id UUID NOT NULL REFERENCES exhibition_authorizations(id) ON DELETE RESTRICT,
    seat_plan_version_id UUID NOT NULL REFERENCES seat_plan_versions(id) ON DELETE RESTRICT,
    show_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    language VARCHAR(50) NOT NULL,
    format VARCHAR(50) NOT NULL,
    booking_open_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    booking_close_at TIMESTAMPTZ,
    status show_status_enum NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
