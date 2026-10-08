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
