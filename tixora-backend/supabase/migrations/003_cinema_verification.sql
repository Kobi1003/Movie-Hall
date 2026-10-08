-- 003_cinema_verification.sql
CREATE TYPE cinema_document_type AS ENUM (
    'CINEMA_LICENCE',
    'BUSINESS_REGISTRATION',
    'OWNERSHIP_PROOF',
    'LEASE_AGREEMENT',
    'FIRE_SAFETY',
    'BUILDING_APPROVAL',
    'OCCUPANCY_DOCUMENT',
    'ELECTRICAL_SAFETY',
    'TRADE_LICENCE',
    'OTHER'
);

CREATE TABLE IF NOT EXISTS cinema_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    status verification_status_enum NOT NULL DEFAULT 'SUBMITTED',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES profiles(id),
    review_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cinema_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    document_type cinema_document_type NOT NULL,
    storage_path TEXT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    reviewed_by UUID REFERENCES profiles(id),
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
