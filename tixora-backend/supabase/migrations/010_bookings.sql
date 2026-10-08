-- 010_bookings.sql
CREATE TYPE booking_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUNDED');
CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE RESTRICT,
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE RESTRICT,
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE RESTRICT,
    status booking_status_enum NOT NULL DEFAULT 'PENDING',
    payment_status payment_status_enum NOT NULL DEFAULT 'PENDING',
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
    platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    idempotency_key VARCHAR(255) UNIQUE,
    food_items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    show_seat_id UUID NOT NULL REFERENCES show_seats(id) ON DELETE RESTRICT,
    seat_label VARCHAR(20) NOT NULL,
    row_label VARCHAR(10) NOT NULL,
    seat_number INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    seat_type VARCHAR(50) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_booking_show_seat UNIQUE(booking_id, show_seat_id)
);

-- Link show_seats booking_id back to bookings
ALTER TABLE show_seats
ADD CONSTRAINT fk_show_seat_booking
FOREIGN KEY (booking_id)
REFERENCES bookings(id)
ON DELETE SET NULL;
