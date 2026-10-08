-- 015_seat_reservations_and_queues.sql
CREATE TYPE reservation_status_enum AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED_TO_BOOKING', 'CANCELLED');
CREATE TYPE queue_status_enum AS ENUM ('WAITING', 'PROMOTED', 'EXPIRED', 'CANCELLED', 'BOOKED', 'SKIPPED');

CREATE TABLE IF NOT EXISTS seat_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hold_id UUID NOT NULL,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    show_seat_ids UUID[] NOT NULL,
    status reservation_status_enum NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    source VARCHAR(50) DEFAULT 'DIRECT_HOLD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seat_queue_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(100) UNIQUE NOT NULL,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    show_seat_id UUID NOT NULL REFERENCES show_seats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status queue_status_enum NOT NULL DEFAULT 'WAITING',
    queue_position INT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for queue sorting and fast FIFO pop
CREATE INDEX IF NOT EXISTS idx_seat_queue_fifo 
ON seat_queue_requests(show_seat_id, queue_position ASC) 
WHERE status = 'WAITING';
