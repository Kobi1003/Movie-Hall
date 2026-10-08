-- 002_cinemas.sql
CREATE TYPE cinema_type_enum AS ENUM ('MULTIPLEX', 'SINGLE_SCREEN', 'PREMIUM', 'IMAX', '4DX', 'DRIVE_IN', 'OTHER');
CREATE TYPE verification_status_enum AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_REQUIRED', 'VERIFIED', 'REJECTED', 'SUSPENDED');

CREATE TABLE IF NOT EXISTS cinemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    cinema_name VARCHAR(255) NOT NULL,
    legal_business_name VARCHAR(255) NOT NULL,
    cinema_type cinema_type_enum NOT NULL DEFAULT 'MULTIPLEX',
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    logo_path TEXT,
    cover_image_path TEXT,
    verification_status verification_status_enum NOT NULL DEFAULT 'DRAFT',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
