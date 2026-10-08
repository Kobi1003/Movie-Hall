# 🎬 TIXORA — Modern Cinema Ticket Booking & Hall Management System

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=flat&logo=node.js)
![React](https://img.shields.io/badge/React-v19-61DAFB?style=flat&logo=react)
![Vite](https://img.shields.io/badge/Vite-v6-646CFF?style=flat&logo=vite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=flat&logo=tailwindcss)
![Redis](https://img.shields.io/badge/Redis-v7-DC382D?style=flat&logo=redis)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-v3-FF6600?style=flat&logo=rabbitmq)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat&logo=supabase)
![License](https://img.shields.io/badge/License-ISC-blue?style=flat)

> **Tixora** is an end-to-end, enterprise-grade movie ticketing and cinema exhibition platform. It connects moviegoers with local cinema halls via intelligent geospatial discovery, zero-race-condition seat holds, and instant digital QR passes, while empowering cinema hall operators with a full-fledged exhibition dashboard.

---

## 🌟 Key Highlights

* 📍 **Smart Geospatial Hall Discovery**: Automatically detects user location and calculates Haversine distances to rank cinemas by closest proximity, complete with city directory search powered by Google Maps Geocoding API.
* ⚡ **High-Concurrency Seat Reservation Engine**: Prevents double-bookings under peak traffic spikes using Redis distributed locks, atomic Lua/PostgreSQL RPC holds, and a 3-minute TTL release timer.
* 🐇 **Asynchronous Queue & Promotion Worker**: Powered by RabbitMQ to process bookings asynchronously and automatically promote next-in-line FIFO users when seats are released.
* 🎨 **Cinema Hall Provider Management**:
  * **Film Catalog & Live Studio Poster Studio**: Upload custom movie posters (PNG, JPG, WEBP) or input image URLs, set release dates, default showtimes, producer credits, and preview real-time theatrical cards.
  * **Draft & Publishing Controls**: Stage movies as drafts or submit legal exhibition licenses (CBFC certificates & distributor agreements) for public scheduling.
  * **Interactive Auditorium & Screen Config**: Custom seat grids supporting standard, VIP, recliner, and accessible tiers.
* 🎟️ **Instant Digital Ticket & QR Verification**: Dynamic ticket pass generation with cryptographically verifiable QR codes for on-site scanning.
* 🌌 **Sleek Cyber-Cinema Aesthetics**: Ultra-responsive dark glassmorphism interface featuring WebGL fluid particle shaders (OGL), Lucide iconography, and reactive micro-interactions.

---

## 🏛️ System Architecture

```text
                               +-------------------------------------+
                               |           React 19 + Vite           |
                               |  Tailwind CSS v4 & OGL Backgrounds  |
                               +------------------+------------------+
                                                  |
                                                  | REST API (JWT / JSON)
                                                  v
                               +-------------------------------------+
                               |         Express.js (Node.js)        |
                               |  Rate Limiting, Multer, Zod Schema  |
                               +----+--------------------+-----+-----+
                                    |                    |     |
              +---------------------+                    |     +-------------------------+
              |                                          |                               |
              v                                          v                               v
    +-------------------+                      +-------------------+           +-------------------+
    |    Redis Cache    |                      |   PostgreSQL /    |           |     RabbitMQ      |
    |  - 180s Seat Lock |                      |     Supabase      |           | - Async Bookings  |
    |  - City Geocodes  |                      | - Row-Level Sec.  |           | - Seat Hold Expiry|
    |  - Rate Limits    |                      | - Atomic RPCs     |           | - FIFO Queue Prom.|
    +-------------------+                      +-------------------+           +-------------------+
```

---

## 🚀 Seat Hold & Booking Workflow

```text
USER SELECTION (Seats A1, A2)
       │
       ▼
Express API (/api/v1/shows/:id/seats/hold)
       ├──> Redis: Acquire distributed locks (`show:{id}:seat:{id}:hold`) with 180s TTL
       ├──> Supabase: Execute atomic RPC `claim_show_seats`
       └──> RabbitMQ: Enqueue `seat.hold.created`
               │
               ├──────────────────────────────────────────┐
               │ (Completed within 3 mins)                │ (Expired / Abandoned)
               ▼                                          ▼
       Payment Confirmed                          SeatExpiryWorker
               │                                          │
       PostgreSQL `confirm_booking`               Release hold in DB & Redis
               │                                          │
       ShowSeat Status -> `BOOKED`                RabbitMQ `seat.queue.promote`
               │                                          │
       Digital Ticket Generated + QR Pass         QueuePromotionWorker
                                                  Promotes next waiting customer!
```

---

## 💻 Tech Stack

### Frontend
* **Core**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [React Router v7](https://reactrouter.com/)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), Custom Neon Glassmorphism (`#03b5d3`, `#8b5cf6`, `#4edea3`)
* **Visuals & Graphics**: [OGL](https://github.com/oframe/ogl) (WebGL shader animations), [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti), [Lucide React](https://lucide.dev/)
* **Client Data**: [Supabase JS Client](https://supabase.com/docs/reference/javascript)

### Backend
* **Runtime**: [Node.js](https://nodejs.org/) (v18+ / v24 tested), [Express.js](https://expressjs.com/)
* **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL 15+, RLS Policies, Stored Procedures/RPCs)
* **Distributed Memory & Messaging**: [Redis](https://redis.io/) (ioredis), [RabbitMQ](https://www.rabbitmq.com/) (amqplib)
* **File Uploads & Media**: [Multer](https://github.com/expressjs/multer) with local static serving and Supabase Storage integration
* **Security & Utilities**: [Helmet](https://helmetjs.github.io/), CORS, [Zod](https://zod.dev/), [JSONWebToken](https://jwt.io/), [QRCode](https://www.npmjs.com/package/qrcode), Express Rate Limit

---

## 📂 Project Structure

```text
Movie-Hall/
├── Frontend/                           # React + Vite Client Application
│   ├── src/
│   │   ├── components/                 # UI components (HallFilmsManagementView, TicketPassModal, etc.)
│   │   ├── pages/                      # Page views (Home, Movies, Theaters, Booking, Provider, Admin)
│   │   ├── utils/                      # Utilities (location.js, proximity calculations)
│   │   ├── api.js                      # Centralized API service & axios/fetch wrappers
│   │   └── App.jsx                     # Router & root app state
│   ├── public/                         # Public static assets
│   ├── tailwind.config.js              # Theme and styling tokens
│   └── vite.config.js                  # Vite server & API proxy rules
│
├── tixora-backend/                     # Express.js REST API & Queue Workers
│   ├── scripts/                        # Database seeders (seed.js)
│   ├── src/
│   │   ├── config/                     # Redis, RabbitMQ, and Supabase connections
│   │   ├── controllers/                # Request handlers
│   │   ├── middleware/                 # Auth, RBAC, Multer upload, and error handling
│   │   ├── routes/                     # REST routes (cinema, provider, movies, shows, bookings, location)
│   │   ├── services/                   # Business logic (MovieService, GeoService, SeatHoldService)
│   │   ├── workers/                    # RabbitMQ queue workers (SeatExpiry, QueuePromotion)
│   │   └── app.js                      # Express configuration & middleware pipeline
│   ├── supabase/migrations/            # PostgreSQL DDL migrations & stored procedures (001-020)
│   ├── docker-compose.yml              # Local container setup (Redis & RabbitMQ)
│   └── server.js                       # HTTP server entrypoint
│
└── README.md                           # Master Project Documentation
```

---

## 🛠️ Getting Started

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Docker Desktop](https://www.docker.com/) (for Redis and RabbitMQ)
* A [Supabase](https://supabase.com/) project (free tier works great)

---

### 2. Backend Setup

1. **Navigate to the backend directory and install dependencies**:
   ```bash
   cd tixora-backend
   npm install
   ```

2. **Start Redis and RabbitMQ via Docker**:
   ```bash
   docker compose up -d
   ```
   * Redis running on: `localhost:6379`
   * RabbitMQ running on: `localhost:5672` (Management UI: `http://localhost:15672`, user: `guest`, pass: `guest`)

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and configure your credentials:
   ```bash
   cp .env.example .env
   ```
   Key variables:
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173

   # Supabase Configuration
   SUPABASE_URL=https://<your-project-id>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

   # Redis & RabbitMQ
   REDIS_URL=redis://localhost:6379
   RABBITMQ_URL=amqp://localhost:5672

   # JWT Secret
   JWT_SECRET=super_secret_jwt_key_here

   # Google Maps Geocoding (Optional for enhanced reverse geocoding)
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

4. **Execute Database Migrations**:
   Run the SQL scripts in `tixora-backend/supabase/migrations/` (from `001_profiles.sql` to `020_movie_default_start_time.sql`) in your Supabase SQL Editor.

5. **Seed Initial Demo Data**:
   ```bash
   npm run seed
   ```

6. **Start the API Server**:
   ```bash
   npm run dev
   ```
   The backend will be running at `http://localhost:5000/api/v1`.

---

### 3. Frontend Setup

1. **Open a new terminal, navigate to the frontend directory, and install dependencies**:
   ```bash
   cd Frontend
   npm install
   ```

2. **Set up Environment Variables**:
   Create a `.env` file inside `Frontend/`:
   ```env
   VITE_API_URL=http://localhost:5000/api/v1
   VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

3. **Start the Vite Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 📡 API Overview

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Server health & readiness probe | No |
| `GET` | `/api/v1/movies` | List published movies | No |
| `GET` | `/api/v1/cinemas` | List verified cinema halls (filterable by city/coords) | No |
| `GET` | `/api/v1/cinemas/cities` | List unique cities with active cinema halls | No |
| `GET` | `/api/v1/location/geocode` | Resolve address/coordinates using Google Maps Geocoding | No |
| `POST` | `/api/v1/cinema/movies/upload-poster` | Upload custom movie poster image (Multer) | Partner / Admin |
| `POST` | `/api/v1/cinema/movies` | Create a movie with poster, date, time, producer | Partner / Admin |
| `POST` | `/api/v1/shows/:id/seats/hold` | Atomically lock selected seats for 180 seconds | User |
| `POST` | `/api/v1/bookings` | Finalize ticket booking and generate QR pass | User |

---

## 🧪 Testing

To run the automated backend test suite (concurrency locks, TTL expiration, and queue promotion):
```bash
cd tixora-backend
npm test
```

To run the frontend production build verification:
```bash
cd Frontend
npm run build
```

---

## 📄 License

This project is licensed under the **ISC License**.
