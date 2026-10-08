-- 007_authorizations.sql
CREATE TYPE authorization_status_enum AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'DOCUMENTS_REQUIRED',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'REVOKED',
    'SUSPENDED'
);

CREATE TYPE commercial_model_enum AS ENUM (
    'REVENUE_SHARE',
    'FIXED_HIRE',
    'MINIMUM_GUARANTEE',
    'HYBRID'
);

CREATE TABLE IF NOT EXISTS exhibition_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    movie_provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    status authorization_status_enum NOT NULL DEFAULT 'DRAFT',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date >= start_date),
    authorized_formats TEXT[] NOT NULL DEFAULT ARRAY['2D'],
    authorized_languages TEXT[] NOT NULL DEFAULT ARRAY['English'],
    max_shows_per_day INT DEFAULT 10,
    min_shows_per_day INT DEFAULT 1,
    earliest_show_time TIME DEFAULT '08:00:00',
    latest_show_time TIME DEFAULT '23:59:00',
    agreement_reference VARCHAR(100),
    commercial_model commercial_model_enum NOT NULL DEFAULT 'REVENUE_SHARE',
    revenue_share_provider NUMERIC(5, 2) CHECK (revenue_share_provider BETWEEN 0 AND 100),
    revenue_share_cinema NUMERIC(5, 2) CHECK (revenue_share_cinema BETWEEN 0 AND 100),
    fixed_hire NUMERIC(12, 2) CHECK (fixed_hire >= 0),
    minimum_guarantee NUMERIC(12, 2) CHECK (minimum_guarantee >= 0),
    additional_terms TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES profiles(id),
    review_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exhibition_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id UUID NOT NULL REFERENCES exhibition_authorizations(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES profiles(id),
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exhibition_authorized_screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id UUID NOT NULL REFERENCES exhibition_authorizations(id) ON DELETE CASCADE,
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auth_screen UNIQUE(authorization_id, screen_id)
);
