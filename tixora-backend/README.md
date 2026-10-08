# TIXORA Backend — Production-Grade Cinema & Seat Ticketing System

TIXORA is an enterprise movie ticket-booking platform backend engineered with **Node.js, Express.js, Supabase (PostgreSQL, Auth, Storage, RLS, RPC), Redis, and RabbitMQ**.

---

## 1. Quick Start

### Prerequisites
* Node.js v18+ (tested on Node v24)
* Docker & Docker Compose (for local Redis and RabbitMQ)

### Step 1: Install Dependencies
```bash
cd tixora-backend
npm install
```

### Step 2: Spin Up Infrastructure (Redis & RabbitMQ)
```bash
docker compose up -d
```
* **Redis**: `localhost:6379`
* **RabbitMQ**: `localhost:5672` (Management Dashboard: `http://localhost:15672`, credentials `guest`/`guest`)

### Step 3: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### Step 4: Populate Seed Data
```bash
npm run seed
```
Creates **PQR Cinema** in Kolkata, two screens, an irregular auditorium layout with recliner/VIP/accessible seats, movie metadata for **Movie XYZ**, an approved exhibition authorization, and an active show at 7:30 PM with show-seat snapshot inventory.

### Step 5: Start the Express Server
```bash
npm start
```
Server runs at `http://localhost:5000/api/v1`.

### Step 6: Run Automated Tests
```bash
npm test
```
Executes concurrency tests, 3-minute hold expiration, FIFO queue promotions, show creation validation, and RBAC authorization tests.

---

## 2. Supabase Setup Guide

### 1. Project Creation
1. Go to [supabase.com](https://supabase.com) and create a new project named `Tixora`.
2. Copy your **Project URL**, **Anon Key**, and **Service Role Key** (under Project Settings -> API) into your `.env` file:
   ```env
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

### 2. Auth Configuration
* In Supabase Dashboard -> Authentication -> Providers, ensure **Email** is enabled.
* Optionally enable Google OAuth provider.

### 3. Storage Buckets Setup
Create the following buckets under Supabase Storage:
* `public-assets` (Public)
* `movie-posters` (Public)
* `cinema-images` (Public)
* `private-cinema-documents` (Private)
* `private-exhibition-documents` (Private)
* `private-provider-documents` (Private)
* `tickets` (Private)

### 4. Database Migrations
Run the SQL files in `supabase/migrations/` sequentially in the Supabase SQL Editor:
1. `001_profiles.sql`
2. `002_cinemas.sql`
3. `003_cinema_verification.sql`
4. `004_screens.sql`
5. `005_seat_plans.sql`
6. `006_movies.sql`
7. `007_authorizations.sql`
8. `008_shows.sql`
9. `009_show_seats.sql`
10. `010_bookings.sql`
11. `011_payments.sql`
12. `012_tickets.sql`
13. `013_notifications.sql`
14. `014_audit_logs.sql`
15. `015_seat_reservations_and_queues.sql`
16. `016_indexes_and_constraints.sql`
17. `017_functions_and_rpc.sql`
18. `018_rls_policies.sql`
19. `019_fix_profile_rls_recursion.sql`
20. `020_movie_default_start_time.sql`

The final profile migration fixes a recursive row-level security policy in the profile
lookup. Apply it in the Supabase SQL Editor before using public-key access to
profiles. Keep the service role key only in the backend environment; never put
it in the frontend.

Migration 020 adds `movies.default_start_time`, used as a suggested show start
time in the cinema film editor. Actual show schedules continue to use
`shows.start_time`.

---

## 3. Advanced Seat Reservation Architecture

```
CUSTOMER REQUEST
       |
       v
Express API
   +--> Redis: Distributed lock & 180-second TTL (`show:{id}:seat:{id}:hold`)
   +--> PostgreSQL: Atomic claim via RPC `claim_show_seats`
   +--> RabbitMQ: Emits `seat.hold.created`
       |
       +---(If expired without payment)----+
       |                                   |
       v                                   v
Payment Verified                     SeatExpiryWorker
       |                                   |
PostgreSQL `confirm_booking`         Release hold in DB & Redis
       |                                   |
ShowSeat -> BOOKED                   RabbitMQ `seat.queue.promote`
       |                                   |
Digital Ticket + QR Code             QueuePromotionWorker
                                           |
                                     Promotes next FIFO waiting user
                                     for a new 3-minute window
```

---

## 4. Connecting the TIXORA Frontend

In your React frontend (`../Frontend/.env` or API config):
```env
VITE_API_URL=http://localhost:5000/api/v1
```
Use the returned JWT token in the `Authorization: Bearer <token>` header for all authenticated customer, cinema partner, and admin requests.

The backend database connection can be checked at
`http://localhost:5000/api/v1/health/database` (or `/health/database` on the
server root). It reports an error when Supabase cannot be reached.
