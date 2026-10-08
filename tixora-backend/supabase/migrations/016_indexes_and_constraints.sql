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
