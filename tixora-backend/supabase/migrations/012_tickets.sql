-- 012_tickets.sql
CREATE TYPE ticket_status_enum AS ENUM ('VALID', 'USED', 'CANCELLED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    ticket_number VARCHAR(100) UNIQUE NOT NULL,
    security_code VARCHAR(50) NOT NULL,
    gate_info VARCHAR(100) DEFAULT 'Auditorium Gate 4 • Level 3',
    qr_code_data TEXT NOT NULL,
    status ticket_status_enum NOT NULL DEFAULT 'VALID',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
