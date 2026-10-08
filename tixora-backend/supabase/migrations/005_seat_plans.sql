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
