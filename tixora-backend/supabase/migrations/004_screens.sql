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
