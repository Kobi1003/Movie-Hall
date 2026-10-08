-- 009_show_seats.sql
CREATE TYPE show_seat_status_enum AS ENUM ('AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED');

CREATE TABLE IF NOT EXISTS show_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE RESTRICT,
    seat_label VARCHAR(20) NOT NULL,
    row_label VARCHAR(10) NOT NULL,
    seat_number INT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    seat_type VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    status show_seat_status_enum NOT NULL DEFAULT 'AVAILABLE',
    hold_id UUID,
    hold_user_id UUID REFERENCES profiles(id),
    held_until TIMESTAMPTZ,
    booking_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_show_seat_per_show UNIQUE(show_id, seat_id)
);
