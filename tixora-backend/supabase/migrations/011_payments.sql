-- 011_payments.sql
CREATE TYPE payment_transaction_status_enum AS ENUM ('CREATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED');

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    provider VARCHAR(50) NOT NULL DEFAULT 'mock',
    provider_payment_id VARCHAR(255) UNIQUE,
    payment_method VARCHAR(50) DEFAULT 'upi',
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status payment_transaction_status_enum NOT NULL DEFAULT 'CREATED',
    failure_code VARCHAR(100),
    failure_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
