-- ========================================================
-- TIXORA COMPLETE DATABASE RESTORE SCHEMA
-- Auto-compiled from migrations 001 to 026
-- ========================================================

-- >>> Migration: 001_profiles.sql <<<
-- 001_profiles.sql
-- Create custom enum for application roles
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'CINEMA_OWNER', 'MOVIE_PROVIDER', 'PLATFORM_ADMIN');

-- Profiles base table linked to Supabase Auth (or standalone UUID for local testing)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    location VARCHAR(255),
    avatar_path TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- >>> Migration: 002_cinemas.sql <<<
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


-- >>> Migration: 003_cinema_verification.sql <<<
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


-- >>> Migration: 004_screens.sql <<<
-- 004_screens.sql
CREATE TABLE IF NOT EXISTS screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    screen_name VARCHAR(100) NOT NULL,
    screen_number INT NOT NULL,
    screen_type VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    capacity INT NOT NULL DEFAULT 0,
    projection_type VARCHAR(100) DEFAULT 'Laser 4K',
    audio_format VARCHAR(100) DEFAULT 'Dolby Atmos',
    supported_formats TEXT[] DEFAULT ARRAY['2D', '3D'],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cinema_screen_number UNIQUE(cinema_id, screen_number)
);


-- >>> Migration: 005_seat_plans.sql <<<
-- 005_seat_plans.sql
CREATE TYPE seat_plan_status_enum AS ENUM ('DRAFT', 'VALIDATING', 'VALID', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE seat_type_enum AS ENUM ('STANDARD', 'PREMIUM', 'RECLINER', 'COUPLE', 'VIP', 'WHEELCHAIR', 'COMPANION', 'ACCESSIBLE');

CREATE TABLE IF NOT EXISTS seat_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Main Layout',
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    active_version_id UUID,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seat_plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_plan_id UUID NOT NULL REFERENCES seat_plans(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    status seat_plan_status_enum NOT NULL DEFAULT 'DRAFT',
    canvas_width INT NOT NULL DEFAULT 1200,
    canvas_height INT NOT NULL DEFAULT 800,
    screen_position VARCHAR(50) NOT NULL DEFAULT 'TOP',
    entrance_position VARCHAR(50) NOT NULL DEFAULT 'BOTTOM',
    created_by UUID REFERENCES profiles(id),
    published_by UUID REFERENCES profiles(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_plan_version UNIQUE(seat_plan_id, version_number)
);

-- Circular FK for active version
ALTER TABLE seat_plans 
ADD CONSTRAINT fk_active_version 
FOREIGN KEY (active_version_id) 
REFERENCES seat_plan_versions(id) 
ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS seat_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_plan_version_id UUID NOT NULL REFERENCES seat_plan_versions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seat_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_plan_version_id UUID NOT NULL REFERENCES seat_plan_versions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    seat_type seat_type_enum NOT NULL DEFAULT 'STANDARD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_plan_version_id UUID NOT NULL REFERENCES seat_plan_versions(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES seat_sections(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES seat_categories(id) ON DELETE RESTRICT,
    row_label VARCHAR(10) NOT NULL,
    seat_number INT NOT NULL,
    seat_type seat_type_enum NOT NULL DEFAULT 'STANDARD',
    x_position NUMERIC(10, 2) NOT NULL,
    y_position NUMERIC(10, 2) NOT NULL,
    rotation NUMERIC(6, 2) NOT NULL DEFAULT 0,
    width NUMERIC(6, 2) NOT NULL DEFAULT 32,
    height NUMERIC(6, 2) NOT NULL DEFAULT 32,
    is_accessible BOOLEAN NOT NULL DEFAULT FALSE,
    is_wheelchair_space BOOLEAN NOT NULL DEFAULT FALSE,
    is_companion_seat BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_seat_in_version UNIQUE(seat_plan_version_id, row_label, seat_number)
);


-- >>> Migration: 006_movies.sql <<<
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


-- >>> Migration: 007_authorizations.sql <<<
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


-- >>> Migration: 008_shows.sql <<<
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


-- >>> Migration: 009_show_seats.sql <<<
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


-- >>> Migration: 010_bookings.sql <<<
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


-- >>> Migration: 011_payments.sql <<<
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


-- >>> Migration: 012_tickets.sql <<<
-- 012_tickets.sql
CREATE TYPE ticket_status_enum AS ENUM ('VALID', 'USED', 'CANCELLED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    ticket_number VARCHAR(100) UNIQUE NOT NULL,
    security_code VARCHAR(50) NOT NULL,
    gate_info VARCHAR(100) DEFAULT 'Auditorium Gate 4 â€¢ Level 3',
    qr_code_data TEXT NOT NULL,
    status ticket_status_enum NOT NULL DEFAULT 'VALID',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- >>> Migration: 013_notifications.sql <<<
-- 013_notifications.sql
CREATE TYPE notification_type_enum AS ENUM (
    'BOOKING_CONFIRMED',
    'PAYMENT_SUCCESS',
    'PAYMENT_FAILED',
    'SEAT_HOLD_EXPIRING',
    'YOUR_TURN',
    'CINEMA_VERIFIED',
    'CINEMA_REJECTED',
    'DOCUMENT_REQUIRED',
    'DOCUMENT_REJECTED',
    'PROVIDER_VERIFIED',
    'AUTHORIZATION_APPROVED',
    'AUTHORIZATION_REJECTED',
    'AUTHORIZATION_EXPIRING',
    'SHOW_CANCELLED',
    'REFUND_PROCESSED'
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- >>> Migration: 014_audit_logs.sql <<<
-- 014_audit_logs.sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- >>> Migration: 015_seat_reservations_and_queues.sql <<<
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


-- >>> Migration: 016_indexes_and_constraints.sql <<<
-- 016_indexes_and_constraints.sql

-- Frequently queried movie filters
CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status);
CREATE INDEX IF NOT EXISTS idx_movies_release_date ON movies(release_date);

-- Cinema location & verification
CREATE INDEX IF NOT EXISTS idx_cinemas_city ON cinemas(city);
CREATE INDEX IF NOT EXISTS idx_cinemas_verification ON cinemas(verification_status);
CREATE INDEX IF NOT EXISTS idx_cinemas_owner ON cinemas(owner_user_id);

-- Screens & seat layouts
CREATE INDEX IF NOT EXISTS idx_screens_cinema ON screens(cinema_id);
CREATE INDEX IF NOT EXISTS idx_seats_version ON seats(seat_plan_version_id);

-- Shows & Inventory
CREATE INDEX IF NOT EXISTS idx_shows_movie ON shows(movie_id);
CREATE INDEX IF NOT EXISTS idx_shows_cinema ON shows(cinema_id);
CREATE INDEX IF NOT EXISTS idx_shows_date ON shows(show_date);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);
CREATE INDEX IF NOT EXISTS idx_show_seats_show ON show_seats(show_id);
CREATE INDEX IF NOT EXISTS idx_show_seats_status ON show_seats(status);
CREATE INDEX IF NOT EXISTS idx_show_seats_hold ON show_seats(hold_id);
CREATE INDEX IF NOT EXISTS idx_show_seats_held_until ON show_seats(held_until);

-- Bookings & Payments
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_show ON bookings(show_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_tickets_booking ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);

-- Authorizations
CREATE INDEX IF NOT EXISTS idx_authorizations_movie ON exhibition_authorizations(movie_id);
CREATE INDEX IF NOT EXISTS idx_authorizations_cinema ON exhibition_authorizations(cinema_id);
CREATE INDEX IF NOT EXISTS idx_authorizations_status ON exhibition_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_authorizations_period ON exhibition_authorizations(start_date, end_date);

-- Audit logs & notifications
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);


-- >>> Migration: 017_functions_and_rpc.sql <<<
-- 017_functions_and_rpc.sql

-- 1. Atomic claim of one or multiple seats for a show (3-minute hold)
CREATE OR REPLACE FUNCTION claim_show_seats(
    p_show_id UUID,
    p_seat_ids UUID[],
    p_user_id UUID,
    p_hold_id UUID,
    p_hold_seconds INT DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_seat_count INT;
    v_locked_count INT;
    v_expires_at TIMESTAMPTZ;
    v_conflicting_labels TEXT[];
BEGIN
    v_seat_count := array_length(p_seat_ids, 1);
    IF v_seat_count IS NULL OR v_seat_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'code', 'EMPTY_SEAT_SELECTION', 'message', 'No seats specified');
    END IF;

    -- Calculate expiration timestamp
    v_expires_at := NOW() + (p_hold_seconds || ' seconds')::INTERVAL;

    -- Lock requested rows separately; PostgreSQL does not allow FOR UPDATE
    -- on an aggregate query.
    PERFORM id
    FROM show_seats
    WHERE show_id = p_show_id AND id = ANY(p_seat_ids)
    FOR UPDATE;

    -- Collect conflicting seat labels after locking the rows
    SELECT array_agg(seat_label)
    INTO v_conflicting_labels
    FROM show_seats
    WHERE show_id = p_show_id
      AND id = ANY(p_seat_ids)
      AND (
          status = 'BOOKED' 
          OR status = 'BLOCKED' 
          OR (status = 'HELD' AND held_until > NOW() AND hold_user_id <> p_user_id)
      )
    ;

    IF v_conflicting_labels IS NOT NULL AND array_length(v_conflicting_labels, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'SEAT_UNAVAILABLE',
            'message', 'One or more selected seats are no longer available.',
            'conflictingSeats', v_conflicting_labels
        );
    END IF;

    -- Check how many target seats exist for this show
    SELECT COUNT(*)
    INTO v_locked_count
    FROM show_seats
    WHERE show_id = p_show_id
      AND id = ANY(p_seat_ids)
      AND (status = 'AVAILABLE' OR (status = 'HELD' AND (held_until <= NOW() OR hold_user_id = p_user_id)))
    ;

    IF v_locked_count <> v_seat_count THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'SEAT_NOT_FOUND_OR_UNAVAILABLE',
            'message', 'Mismatch between requested seats and available inventory'
        );
    END IF;

    -- Perform atomic state transition to HELD
    UPDATE show_seats
    SET status = 'HELD',
        hold_id = p_hold_id,
        hold_user_id = p_user_id,
        held_until = v_expires_at,
        updated_at = NOW()
    WHERE show_id = p_show_id
      AND id = ANY(p_seat_ids);

    -- Record durable seat reservation entry
    INSERT INTO seat_reservations (
        hold_id,
        show_id,
        user_id,
        show_seat_ids,
        status,
        expires_at
    ) VALUES (
        p_hold_id,
        p_show_id,
        p_user_id,
        p_seat_ids,
        'ACTIVE',
        v_expires_at
    );

    RETURN jsonb_build_object(
        'success', true,
        'holdId', p_hold_id,
        'showId', p_show_id,
        'seatsClaimed', v_seat_count,
        'expiresAt', v_expires_at
    );
END;
$$;


-- 2. Atomic voluntary release of held seats
CREATE OR REPLACE FUNCTION release_show_seats(
    p_show_id UUID,
    p_hold_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_released_count INT;
BEGIN
    UPDATE show_seats
    SET status = 'AVAILABLE',
        hold_id = NULL,
        hold_user_id = NULL,
        held_until = NULL,
        updated_at = NOW()
    WHERE show_id = p_show_id
      AND hold_id = p_hold_id
      AND (hold_user_id = p_user_id OR p_user_id IS NULL)
      AND status = 'HELD';

    GET DIAGNOSTICS v_released_count = ROW_COUNT;

    UPDATE seat_reservations
    SET status = 'RELEASED',
        released_at = NOW()
    WHERE hold_id = p_hold_id;

    RETURN jsonb_build_object(
        'success', true,
        'releasedCount', v_released_count
    );
END;
$$;


-- 3. Atomic confirmation of booking on payment verification
CREATE OR REPLACE FUNCTION confirm_booking(
    p_booking_id UUID,
    p_user_id UUID,
    p_provider_payment_id VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_booking RECORD;
    v_seat_ids UUID[];
    v_ticket_id UUID;
    v_ticket_number VARCHAR(100);
    v_security_code VARCHAR(50);
    v_qr_code_data TEXT;
    v_unheld_count INT;
BEGIN
    -- Retrieve and lock booking
    SELECT * INTO v_booking
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'BOOKING_NOT_FOUND', 'message', 'Booking does not exist');
    END IF;

    IF v_booking.status = 'CONFIRMED' THEN
        -- Already confirmed (idempotent call)
        SELECT ticket_number, qr_code_data INTO v_ticket_number, v_qr_code_data
        FROM tickets WHERE booking_id = p_booking_id LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Booking already confirmed',
            'bookingId', p_booking_id,
            'ticketNumber', v_ticket_number,
            'qrCodeData', v_qr_code_data
        );
    END IF;

    IF v_booking.status <> 'PENDING' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_BOOKING_STATUS', 'message', 'Booking is not pending');
    END IF;

    -- Collect seats associated with booking
    SELECT array_agg(show_seat_id)
    INTO v_seat_ids
    FROM booking_seats
    WHERE booking_id = p_booking_id;

    -- Verify that every seat is currently HELD by the user and not expired
    PERFORM id
    FROM show_seats
    WHERE id = ANY(v_seat_ids)
    FOR UPDATE;

    SELECT COUNT(*)
    INTO v_unheld_count
    FROM show_seats
    WHERE id = ANY(v_seat_ids)
      AND (
          status <> 'HELD' 
          OR hold_user_id <> p_user_id 
          OR held_until < NOW()
      )
    ;

    IF v_unheld_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'HOLD_EXPIRED_OR_INVALID',
            'message', 'Seat hold has expired or belongs to another user.'
        );
    END IF;

    -- Transition show_seats to BOOKED
    UPDATE show_seats
    SET status = 'BOOKED',
        booking_id = p_booking_id,
        hold_id = NULL,
        held_until = NULL,
        updated_at = NOW()
    WHERE id = ANY(v_seat_ids);

    -- Mark booking CONFIRMED and PAID
    UPDATE bookings
    SET status = 'CONFIRMED',
        payment_status = 'PAID',
        updated_at = NOW()
    WHERE id = p_booking_id;

    -- Update payments table
    UPDATE payments
    SET status = 'SUCCESS',
        provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
        updated_at = NOW()
    WHERE booking_id = p_booking_id;

    -- Mark reservations converted
    UPDATE seat_reservations
    SET status = 'CONVERTED_TO_BOOKING',
        booking_id = p_booking_id
    WHERE user_id = p_user_id AND show_id = v_booking.show_id AND status = 'ACTIVE';

    -- Generate digital ticket
    v_ticket_id := gen_random_uuid();
    v_ticket_number := 'TIX-' || UPPER(SUBSTRING(REPLACE(v_booking.id::text, '-', ''), 1, 8));
    v_security_code := 'SEC-' || (1000 + FLOOR(RANDOM() * 9000))::INT;
    v_qr_code_data := jsonb_build_object(
        'ticketNumber', v_ticket_number,
        'bookingReference', v_booking.booking_reference,
        'showId', v_booking.show_id,
        'cinemaId', v_booking.cinema_id,
        'seats', v_seat_ids,
        'securityCode', v_security_code
    )::text;

    INSERT INTO tickets (
        id,
        booking_id,
        ticket_number,
        security_code,
        gate_info,
        qr_code_data,
        status,
        issued_at
    ) VALUES (
        v_ticket_id,
        p_booking_id,
        v_ticket_number,
        v_security_code,
        'Auditorium Gate 4 â€¢ Level 3',
        v_qr_code_data,
        'VALID',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'bookingId', p_booking_id,
        'ticketId', v_ticket_id,
        'ticketNumber', v_ticket_number,
        'securityCode', v_security_code,
        'qrCodeData', v_qr_code_data
    );
END;
$$;


-- 4. Expire single or batch of holds when timer elapses without payment
CREATE OR REPLACE FUNCTION expire_hold(
    p_show_id UUID,
    p_hold_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_expired_count INT;
BEGIN
    -- Check that seats are HELD and not already confirmed/booked
    UPDATE show_seats
    SET status = 'AVAILABLE',
        hold_id = NULL,
        hold_user_id = NULL,
        held_until = NULL,
        updated_at = NOW()
    WHERE show_id = p_show_id
      AND hold_id = p_hold_id
      AND status = 'HELD';

    GET DIAGNOSTICS v_expired_count = ROW_COUNT;

    UPDATE seat_reservations
    SET status = 'EXPIRED'
    WHERE hold_id = p_hold_id AND status = 'ACTIVE';

    RETURN jsonb_build_object(
        'success', true,
        'expiredCount', v_expired_count
    );
END;
$$;


-- 5. Promote the next customer in FIFO waiting queue for a specific seat
CREATE OR REPLACE FUNCTION promote_queue_request(
    p_show_id UUID,
    p_show_seat_id UUID,
    p_new_hold_id UUID,
    p_hold_seconds INT DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_request RECORD;
    v_seat RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Lock target show_seat
    SELECT * INTO v_seat
    FROM show_seats
    WHERE id = p_show_seat_id AND show_id = p_show_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'SEAT_NOT_FOUND');
    END IF;

    -- Seat must not be booked or blocked
    IF v_seat.status = 'BOOKED' OR v_seat.status = 'BLOCKED' THEN
        RETURN jsonb_build_object('success', false, 'code', 'SEAT_NOT_PROMOTABLE', 'status', v_seat.status);
    END IF;

    -- Find next active WAITING queue request
    SELECT * INTO v_next_request
    FROM seat_queue_requests
    WHERE show_seat_id = p_show_seat_id
      AND status = 'WAITING'
    ORDER BY queue_position ASC, joined_at ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Queue is empty; seat remains AVAILABLE
        UPDATE show_seats
        SET status = 'AVAILABLE', hold_id = NULL, hold_user_id = NULL, held_until = NULL, updated_at = NOW()
        WHERE id = p_show_seat_id;

        RETURN jsonb_build_object('success', true, 'promoted', false, 'message', 'Queue empty');
    END IF;

    v_expires_at := NOW() + (p_hold_seconds || ' seconds')::INTERVAL;

    -- Transition seat to HELD for the promoted customer
    UPDATE show_seats
    SET status = 'HELD',
        hold_id = p_new_hold_id,
        hold_user_id = v_next_request.user_id,
        held_until = v_expires_at,
        updated_at = NOW()
    WHERE id = p_show_seat_id;

    -- Update queue request status
    UPDATE seat_queue_requests
    SET status = 'PROMOTED',
        promoted_at = NOW(),
        expires_at = v_expires_at,
        updated_at = NOW()
    WHERE id = v_next_request.id;

    -- Create reservation record
    INSERT INTO seat_reservations (
        hold_id,
        show_id,
        user_id,
        show_seat_ids,
        status,
        expires_at,
        source
    ) VALUES (
        p_new_hold_id,
        p_show_id,
        v_next_request.user_id,
        ARRAY[p_show_seat_id],
        'ACTIVE',
        v_expires_at,
        'QUEUE_PROMOTION'
    );

    RETURN jsonb_build_object(
        'success', true,
        'promoted', true,
        'queueRequestId', v_next_request.request_id,
        'userId', v_next_request.user_id,
        'holdId', p_new_hold_id,
        'showSeatId', p_show_seat_id,
        'expiresAt', v_expires_at
    );
END;
$$;


-- 6. Clone physical layout of screen into show-specific show_seats inventory
CREATE OR REPLACE FUNCTION create_show_inventory(
    p_show_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_show RECORD;
    v_inserted_count INT;
BEGIN
    SELECT * INTO v_show FROM shows WHERE id = p_show_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'SHOW_NOT_FOUND');
    END IF;

    -- Insert seats from the specified seat_plan_version
    INSERT INTO show_seats (
        show_id,
        seat_id,
        seat_label,
        row_label,
        seat_number,
        category_name,
        seat_type,
        price,
        status
    )
    SELECT
        p_show_id,
        s.id,
        s.row_label || s.seat_number::text,
        s.row_label,
        s.seat_number,
        sc.display_name,
        s.seat_type::text,
        sc.base_price,
        'AVAILABLE'::show_seat_status_enum
    FROM seats s
    JOIN seat_categories sc ON s.category_id = sc.id
    WHERE s.seat_plan_version_id = v_show.seat_plan_version_id
      AND s.is_active = TRUE;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'showId', p_show_id,
        'seatsCreated', v_inserted_count
    );
END;
$$;


-- >>> Migration: 018_rls_policies.sql <<<
-- 018_rls_policies.sql

-- Enable RLS on core tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cinemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibition_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to extract auth role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT role::text FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- 1. Profiles: Users can read their own profile, Admins can read all
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = auth_user_id OR current_user_role() = 'PLATFORM_ADMIN');

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- 2. Cinemas: Public can view verified active cinemas, Owners manage theirs, Admin manages all
CREATE POLICY "Public can view verified cinemas" ON cinemas
    FOR SELECT USING (verification_status = 'VERIFIED' AND is_active = TRUE);

CREATE POLICY "Owners can manage own cinemas" ON cinemas
    FOR ALL USING (owner_user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()) OR current_user_role() = 'PLATFORM_ADMIN');

-- 3. Movies: Public can view active movies, Providers manage theirs, Admin manages all
CREATE POLICY "Public can view active movies" ON movies
    FOR SELECT USING (status IN ('ACTIVE', 'UPCOMING'));

CREATE POLICY "Providers can manage own movies" ON movies
    FOR ALL USING (created_by_provider = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()) OR current_user_role() = 'PLATFORM_ADMIN');

-- 4. Shows & Show Seats: Public can read published shows
CREATE POLICY "Public can view published shows" ON shows
    FOR SELECT USING (status = 'PUBLISHED');

CREATE POLICY "Public can view show seats for published shows" ON show_seats
    FOR SELECT USING (show_id IN (SELECT id FROM shows WHERE status = 'PUBLISHED'));

-- 5. Bookings & Tickets: Customers view their own, Cinema Owners view their cinema's bookings
CREATE POLICY "Users can view own bookings" ON bookings
    FOR SELECT USING (user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()) OR current_user_role() = 'PLATFORM_ADMIN');

CREATE POLICY "Users can view own tickets" ON tickets
    FOR SELECT USING (booking_id IN (SELECT id FROM bookings WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())));

-- 6. Notifications: Users view own
CREATE POLICY "Users view own notifications" ON notifications
    FOR ALL USING (user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

-- 7. Audit Logs: Admin only
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (current_user_role() = 'PLATFORM_ADMIN');


-- >>> Migration: 019_fix_profile_rls_recursion.sql <<<
-- current_user_role() previously queried profiles as the calling user. Since
-- the profiles SELECT policy also called current_user_role(), Postgres recursed
-- until it exceeded max_stack_depth. Keep the role lookup in a non-exposed
-- schema and restrict it to the current Supabase Auth user.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role::text
  FROM public.profiles
  WHERE auth_user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = auth_user_id OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = auth_user_id)
  WITH CHECK ((SELECT auth.uid()) = auth_user_id);

DROP POLICY IF EXISTS "Owners can manage own cinemas" ON public.cinemas;
CREATE POLICY "Owners can manage own cinemas" ON public.cinemas
  FOR ALL TO authenticated
  USING (owner_user_id = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN')
  WITH CHECK (owner_user_id = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP POLICY IF EXISTS "Providers can manage own movies" ON public.movies;
CREATE POLICY "Providers can manage own movies" ON public.movies
  FOR ALL TO authenticated
  USING (created_by_provider = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN')
  WITH CHECK (created_by_provider = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP FUNCTION IF EXISTS public.current_user_role();

-- The original claim function used SELECT aggregates with FOR UPDATE, which
-- PostgreSQL rejects at execution time. Lock the requested inventory rows
-- first, then validate their current state before changing any of them.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hold_id UUID;
CREATE INDEX IF NOT EXISTS idx_bookings_hold_id ON public.bookings(hold_id);

CREATE OR REPLACE FUNCTION public.claim_show_seats(
  p_show_id UUID,
  p_seat_ids UUID[],
  p_user_id UUID,
  p_hold_id UUID,
  p_hold_seconds INT DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_seat_count INT;
  v_available_count INT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_seat_count := COALESCE(array_length(p_seat_ids, 1), 0);
  IF v_seat_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_SEAT_SELECTION', 'message', 'No seats specified');
  END IF;

  PERFORM 1
  FROM public.show_seats
  WHERE show_id = p_show_id AND id = ANY(p_seat_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_available_count
  FROM public.show_seats
  WHERE show_id = p_show_id
    AND id = ANY(p_seat_ids)
    AND (status = 'AVAILABLE' OR (status = 'HELD' AND (held_until <= NOW() OR hold_user_id = p_user_id)));

  IF v_available_count <> v_seat_count THEN
    RETURN jsonb_build_object('success', false, 'code', 'SEAT_UNAVAILABLE', 'message', 'One or more seats are no longer available.');
  END IF;

  v_expires_at := NOW() + make_interval(secs => p_hold_seconds);
  UPDATE public.show_seats
  SET status = 'HELD', hold_id = p_hold_id, hold_user_id = p_user_id,
      held_until = v_expires_at, updated_at = NOW()
  WHERE show_id = p_show_id AND id = ANY(p_seat_ids);

  INSERT INTO public.seat_reservations (hold_id, show_id, user_id, show_seat_ids, status, expires_at)
  VALUES (p_hold_id, p_show_id, p_user_id, p_seat_ids, 'ACTIVE', v_expires_at);

  RETURN jsonb_build_object('success', true, 'holdId', p_hold_id, 'showId', p_show_id,
    'seatsClaimed', v_seat_count, 'expiresAt', v_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_booking_id UUID,
  p_user_id UUID,
  p_provider_payment_id VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking RECORD;
  v_seat_ids UUID[];
  v_ticket_id UUID;
  v_ticket_number VARCHAR(100);
  v_security_code VARCHAR(50);
  v_qr_code_data TEXT;
  v_unheld_count INT;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'BOOKING_NOT_FOUND', 'message', 'Booking does not exist');
  END IF;
  IF v_booking.user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'BOOKING_OWNER_MISMATCH', 'message', 'Booking owner does not match');
  END IF;
  IF v_booking.status = 'CONFIRMED' THEN
    SELECT ticket_number, qr_code_data INTO v_ticket_number, v_qr_code_data
    FROM public.tickets WHERE booking_id = p_booking_id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'message', 'Booking already confirmed',
      'bookingId', p_booking_id, 'ticketNumber', v_ticket_number, 'qrCodeData', v_qr_code_data);
  END IF;
  IF v_booking.status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_BOOKING_STATUS', 'message', 'Booking is not pending');
  END IF;

  SELECT array_agg(show_seat_id) INTO v_seat_ids
  FROM public.booking_seats WHERE booking_id = p_booking_id;
  IF COALESCE(array_length(v_seat_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'BOOKING_HAS_NO_SEATS', 'message', 'Booking has no reserved seats');
  END IF;

  PERFORM 1 FROM public.show_seats WHERE id = ANY(v_seat_ids) ORDER BY id FOR UPDATE;
  SELECT COUNT(*) INTO v_unheld_count FROM public.show_seats
  WHERE id = ANY(v_seat_ids)
    AND (status <> 'HELD' OR hold_user_id <> p_user_id OR held_until IS NULL OR held_until < NOW());
  IF v_unheld_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'HOLD_EXPIRED_OR_INVALID',
      'message', 'Seat hold has expired or belongs to another user.');
  END IF;

  UPDATE public.show_seats
  SET status = 'BOOKED', booking_id = p_booking_id, hold_id = NULL,
      held_until = NULL, updated_at = NOW()
  WHERE id = ANY(v_seat_ids);
  UPDATE public.bookings SET status = 'CONFIRMED', payment_status = 'PAID', updated_at = NOW()
  WHERE id = p_booking_id;
  UPDATE public.payments SET status = 'SUCCESS',
    provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id), updated_at = NOW()
  WHERE booking_id = p_booking_id;
  UPDATE public.seat_reservations SET status = 'CONVERTED_TO_BOOKING', booking_id = p_booking_id
  WHERE hold_id = v_booking.hold_id AND user_id = p_user_id AND show_id = v_booking.show_id AND status = 'ACTIVE';

  v_ticket_id := gen_random_uuid();
  v_ticket_number := 'TIX-' || UPPER(SUBSTRING(REPLACE(v_booking.id::text, '-', ''), 1, 8));
  v_security_code := 'SEC-' || (1000 + FLOOR(RANDOM() * 9000))::INT;
  v_qr_code_data := jsonb_build_object('ticketNumber', v_ticket_number,
    'bookingReference', v_booking.booking_reference, 'showId', v_booking.show_id,
    'cinemaId', v_booking.cinema_id, 'seats', v_seat_ids,
    'securityCode', v_security_code)::text;
  INSERT INTO public.tickets (id, booking_id, ticket_number, security_code, gate_info, qr_code_data, status, issued_at)
  VALUES (v_ticket_id, p_booking_id, v_ticket_number, v_security_code,
    'Auditorium Gate 4 â€¢ Level 3', v_qr_code_data, 'VALID', NOW());
  RETURN jsonb_build_object('success', true, 'bookingId', p_booking_id,
    'ticketId', v_ticket_id, 'ticketNumber', v_ticket_number,
    'securityCode', v_security_code, 'qrCodeData', v_qr_code_data);
END;
$$;

-- These state-changing RPCs are backend-only; never expose them to browser roles.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_show_seats(UUID, UUID[], UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_show_seats(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_booking(UUID, UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_hold(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_queue_request(UUID, UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_show_inventory(UUID) TO service_role;


-- >>> Migration: 020_movie_default_start_time.sql <<<
-- Store the partner's preferred default showtime with film metadata.
-- Actual scheduled screenings continue to store their own start_time in shows.
ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS default_start_time TIME;


-- >>> Migration: 021_movie_formats.sql <<<
-- Preserve the provider-selected exhibition formats with the submitted movie.
ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS formats TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];


-- >>> Migration: 022_provider_user_sections_and_movie_catalog.sql <<<
-- Keep provider ownership and show scheduling in the normalized core tables.
-- The dashboard groups records in the API; database views and duplicate role
-- columns are not needed for those UI sections.

ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS default_start_time TIME,
  ADD COLUMN IF NOT EXISTS formats TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_movies_created_by_provider
  ON public.movies(created_by_provider);

CREATE INDEX IF NOT EXISTS idx_shows_movie_date
  ON public.shows(movie_id, show_date);


-- >>> Migration: 023_database_cleanup.sql <<<
-- Remove only profile extensions and role columns that are superseded by
-- profiles.role. Movies, schedules, seat inventory, bookings and ticket history
-- remain in the core relational schema.

DO $$
DECLARE
  relation_name TEXT;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'normal_users_section',
    'movie_providers_section',
    'movie_provider_films_section',
    'movie_providers_with_films'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = relation_name AND c.relkind = 'v'
    ) THEN
      EXECUTE format('DROP VIEW public.%I', relation_name);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_sync_profile_types ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_types();
DROP FUNCTION IF EXISTS public.trg_movie_provider_films_section_dml();

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS provider_type,
  DROP COLUMN IF EXISTS user_type;

DROP TABLE IF EXISTS public.customer_profiles;
DROP TABLE IF EXISTS public.cinema_owner_profiles;
DROP TABLE IF EXISTS public.movie_provider_profiles;
DROP TABLE IF EXISTS public.admin_profiles;

-- Keep the baseline single-column show indexes and remove accidental duplicates.
DROP INDEX IF EXISTS public.idx_shows_movie_id;
DROP INDEX IF EXISTS public.idx_shows_show_date;


-- >>> Migration: 024_restore_seat_categories.sql <<<
-- Seat categories are required by seat-plan editing, live seat maps and show
-- inventory pricing. Restore the table and recover the category identifiers
-- still referenced by the existing 256 seat rows.
CREATE TABLE IF NOT EXISTS public.seat_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_plan_version_id UUID NOT NULL REFERENCES public.seat_plan_versions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  seat_type public.seat_type_enum NOT NULL DEFAULT 'STANDARD',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH type_counts AS (
  SELECT seat_plan_version_id, category_id, seat_type::TEXT AS seat_type, COUNT(*) AS seats
  FROM public.seats
  GROUP BY seat_plan_version_id, category_id, seat_type
), dominant_types AS (
  SELECT DISTINCT ON (seat_plan_version_id, category_id)
    seat_plan_version_id, category_id, seat_type
  FROM type_counts
  ORDER BY seat_plan_version_id, category_id, seats DESC, seat_type
)
INSERT INTO public.seat_categories (
  id, seat_plan_version_id, name, display_name, base_price, currency, seat_type
)
SELECT
  category_id,
  seat_plan_version_id,
  CASE seat_type
    WHEN 'RECLINER' THEN 'recliner'
    WHEN 'VIP' THEN 'vip'
    WHEN 'PREMIUM' THEN 'premium'
    ELSE 'classic'
  END,
  CASE seat_type
    WHEN 'RECLINER' THEN 'Recliner Lounge'
    WHEN 'VIP' THEN 'VIP Deluxe'
    WHEN 'PREMIUM' THEN 'Premium Gallery'
    ELSE 'Classic Stalls'
  END,
  CASE seat_type
    WHEN 'RECLINER' THEN 950
    WHEN 'VIP' THEN 650
    WHEN 'PREMIUM' THEN 500
    ELSE 350
  END,
  'INR',
  seat_type::public.seat_type_enum
FROM dominant_types
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.seats'::regclass AND conname = 'seats_category_id_fkey'
  ) THEN
    ALTER TABLE public.seats
      ADD CONSTRAINT seats_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.seat_categories(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_seat_categories_version
  ON public.seat_categories(seat_plan_version_id);
ALTER TABLE public.seat_categories ENABLE ROW LEVEL SECURITY;


-- >>> Migration: 025_remove_orphan_database_objects.sql <<<
-- Remove leftovers from the abandoned database-section view and duplicate indexes.
DROP FUNCTION IF EXISTS public.trg_movie_provider_films_section_dml();
DROP INDEX IF EXISTS public.idx_shows_movie_id;
DROP INDEX IF EXISTS public.idx_shows_show_date;


-- >>> Migration: 026_profile_organization_name.sql <<<
-- Store the cinema/provider organization name entered during registration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);

-- Keep previously registered cinema names visible on their owner profiles.
UPDATE public.profiles AS profile
SET organization_name = cinema.cinema_name
FROM public.cinemas AS cinema
WHERE cinema.owner_user_id = profile.id
  AND profile.organization_name IS NULL;


