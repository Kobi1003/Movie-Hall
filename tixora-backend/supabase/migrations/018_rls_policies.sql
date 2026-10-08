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
