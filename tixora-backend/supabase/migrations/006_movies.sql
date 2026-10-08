-- 006_movies.sql
CREATE TYPE movie_status_enum AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'UPCOMING', 'EXPIRED', 'SUSPENDED');
CREATE TYPE movie_document_type AS ENUM ('CBFC_CERTIFICATE', 'DISTRIBUTION_DEED', 'EXHIBITION_DEED', 'AUTHORIZATION_LETTER', 'RIGHTS_DOCUMENT', 'OTHER');

CREATE TABLE IF NOT EXISTS movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_code VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    original_title VARCHAR(255),
    synopsis TEXT,
    theatrical_overview TEXT,
    original_language VARCHAR(50) NOT NULL,
    languages TEXT[] NOT NULL DEFAULT ARRAY['English'],
    genres TEXT[] NOT NULL DEFAULT ARRAY['Drama'],
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    release_date DATE NOT NULL,
    director_name VARCHAR(255) NOT NULL,
    producer_name VARCHAR(255) NOT NULL,
    production_company VARCHAR(255),
    distributor_name VARCHAR(255),
    cbfc_certificate_number VARCHAR(100),
    cbfc_certification VARCHAR(20) DEFAULT 'UA',
    cbfc_certificate_date DATE,
    poster_path TEXT,
    backdrop_path TEXT,
    trailer_url TEXT,
    status movie_status_enum NOT NULL DEFAULT 'DRAFT',
    created_by_provider UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movie_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    document_type movie_document_type NOT NULL,
    storage_path TEXT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES profiles(id),
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
