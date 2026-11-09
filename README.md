# 🎬 TIXORA — Enterprise Cinema Ticketing & Hall Exhibition Platform

[![Live App](https://img.shields.io/badge/Live%20App-Vercel-black?style=for-the-badge&logo=vercel)](https://movie-hall-bice.vercel.app/)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render-46E3B7?style=for-the-badge&logo=render)](https://tixora-backend-w24j.onrender.com/health)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B%20%7C%20v24-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)

> **TIXORA** is a full-stack, enterprise-grade cinema ticket booking and multi-hall exhibition platform. Built with high-concurrency seat reservation locks, zero-race-condition booking queues, dynamic QR ticket passes, automated EmailJS ticketing dispatch, a multi-screen cinema provider studio, and a cryptographic root-access admin console.

---

## 🌐 Live Production Deployments

| Component | Cloud Provider | URL | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | **Vercel** | [https://movie-hall-bice.vercel.app/](https://movie-hall-bice.vercel.app/) | ![Production](https://img.shields.io/badge/status-live-brightgreen?style=flat-square) |
| **Backend REST API** | **Render** | [https://tixora-backend-w24j.onrender.com](https://tixora-backend-w24j.onrender.com) | ![Production](https://img.shields.io/badge/status-healthy-brightgreen?style=flat-square) |
| **API Health & Probe** | **Render** | [https://tixora-backend-w24j.onrender.com/health](https://tixora-backend-w24j.onrender.com/health) | ![JSON Probe](https://img.shields.io/badge/probe-200%20OK-blue?style=flat-square) |
| **Database & Auth** | **Supabase** | Cloud PostgreSQL 15 + RLS | ![Active](https://img.shields.io/badge/status-connected-success?style=flat-square) |

---

## 🌟 Key Platform Highlights

### 🎟️ 1. Consumer Booking & Ticketing
- **Live Seat Inventory & Atomic Holds**: Distributed locks with a 120–180 second hold countdown timer prevent double-booking during traffic surges.
- **Instant QR Passes & Ticket Passes**: Cryptographic QR codes for ticket validation with seat, screen, and cinema hall verification.
- **Automated Email Dispatch**: Instant confirmation emails dispatched to users upon ticket purchase with complete booking breakdown.
- **Proximity-Based Discovery**: GPS location detection and Haversine distance calculations to find nearby cinema halls.

### 🏢 2. Cinema Partner Console (Exhibitor Studio)
- **Isolated Hall Film Management**: Exhibitors strictly manage movies, showtimes, and screens for their specific cinema hall.
- **Seat Layout Studio**: Interactive seat map designer for Recliner Lounge, VIP Deluxe, Executive Premium, and Classic Stall tiers.
- **Statutory Document Submission**: Secure upload of CBFC Exhibitor Licences, Theatrical Distribution Deeds, and Fire Safety NOCs for verification.

### 🛡️ 3. Super Admin Root Console
- **Master Root Access Key Challenge**: Guarded by master clearance key `TIX-098-245`. Without this key, all admin APIs reject requests with `401 INVALID_ROOT_KEY`.
- **Zero Public Surface**: No admin links or shortcuts exist on public navigation bars. Direct entry requires navigation to `/admin` and passing the master key challenge.
- **Compliance & Film Approval**: One-click verification of cinema compliance certificates and instant film authorization for public booking.

---

## 🏛️ System Architecture

```text
                                +-------------------------------------+
                                |      React 19 + Vite (Frontend)     |
                                |  Tailwind CSS v4 & OGL Visuals      |
                                +------------------+------------------+
                                                   |
                                                   | REST API (HTTPS / JSON / JWT)
                                                   v
                                +-------------------------------------+
                                |      Express.js (tixora-backend)    |
                                |  Helmet, CORS, Multer, Rate Limiting|
                                +----+--------------------+-----+-----+
                                     |                    |     |
               +---------------------+                    |     +-------------------------+
               |                                          |                               |
               v                                          v                               v
     +-------------------+                      +-------------------+           +-------------------+
     |   Redis / Cache   |                      |    PostgreSQL     |           |     RabbitMQ      |
     |  - Distributed TTL|                      |     (Supabase)    |           | - Async Bookings  |
     |  - In-Memory Mock |                      | - Row Level Sec.  |           | - Seat Hold Expiry|
     |    Fallback Engine|                      | - Atomic RPCs     |           | - Queue Promotion |
     +-------------------+                      +-------------------+           +-------------------+
```

---

## 🛠️ Local Development Setup

Follow these steps to run TIXORA on your local machine.

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **Git**: Installed and configured
- **Docker** *(Optional)*: For running local Redis & RabbitMQ instances (the server automatically uses built-in in-memory fallbacks if Docker is not running).

---

### 2. Clone the Repository

```bash
git clone https://github.com/Kobi1003/Movie-Hall.git
cd Movie-Hall
```

---

### 3. Backend Setup (`tixora-backend`)

1. **Navigate to the backend folder**:
   ```bash
   cd tixora-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in `tixora-backend/`:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   API_PREFIX=/api/v1
   CORS_ORIGIN=http://localhost:5173,http://localhost:3000

   # Supabase Database & Auth
   SUPABASE_URL=https://<your-project-id>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

   # Authentication & Security
   JWT_SECRET=your-32-char-random-jwt-secret-key-here
   TIXORA_ROOT_ACCESS_KEY=TIX-098-245

   # Seat Hold Durations (Seconds)
   SEAT_HOLD_SECONDS=120
   CUSTOMER_BOOKING_SECONDS=120
   MAX_SEAT_SELECTION=10

   # Automated Ticketing Email Service (EmailJS)
   EMAILJS_SERVICE_ID=your-emailjs-service-id
   EMAILJS_TEMPLATE_ID=your-emailjs-template-id
   EMAILJS_PUBLIC_KEY=your-emailjs-public-key
   EMAILJS_PRIVATE_KEY=your-emailjs-private-key
   ```

4. **Start the Backend Server**:
   ```bash
   npm start
   ```
   * The API server will boot on `http://localhost:5000/api/v1`
   * Health endpoint: `http://localhost:5000/health`

---

### 4. Frontend Setup (`Frontend`)

1. **Open a new terminal window** and navigate to `Frontend`:
   ```bash
   cd Frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in `Frontend/`:
   ```env
   VITE_API_URL=/api/v1
   VITE_BACKEND_URL=http://localhost:5000
   VITE_TIXORA_ROOT_ACCESS_KEY=TIX-098-245
   ```

4. **Start the Vite Development Server**:
   ```bash
   npm run dev
   ```
   * Open **`http://localhost:5173`** in your browser.

---

## 🔐 Credentials & Access Reference

| Portal | URL Path | Credentials / Access Key | Role |
| :--- | :--- | :--- | :--- |
| **Consumer Portal** | `/discover` or `/book` | Create account or login with email/password | General Audience |
| **Cinema Partner Studio** | `/partner/films` | Log in with cinema exhibitor account | Cinema Owner |
| **Super Admin Console** | `/admin` | Root Access Key: `TIX-098-245` | Master Platform Admin |

---

## 📡 REST API Route Index

### Public Discovery & Movies
- `GET  /health` — Service readiness and database connection probe
- `GET  /api/v1/movies` — List all published theatrical titles
- `GET  /api/v1/shows?movieId=:id` — Get showtimes, screen details, and available seat counts
- `GET  /api/v1/shows/:id/seat-map` — Fetch sectioned seating layout (Recliner, VIP, Executive, Stall)
- `GET  /api/v1/cinemas` — List verified cinema halls with geospatial distance ranking

### Seat Reservation & Bookings
- `POST /api/v1/shows/:id/hold` — Acquire atomic distributed seat locks (120s TTL)
- `POST /api/v1/bookings` — Create pending reservation
- `POST /api/v1/payments/confirm` — Confirm payment, mark seats `BOOKED`, and dispatch ticket email
- `GET  /api/v1/bookings/my` — Retrieve authenticated user's digital passes and QR codes

### Exhibitor & Cinema Partner
- `GET  /api/v1/cinema/movies` — List movies strictly registered to the authenticated exhibitor
- `POST /api/v1/cinema/movies` — Register film with synopsis, duration, artwork, and formats
- `POST /api/v1/cinema/movies/upload-poster` — Upload key art poster (Multer)
- `POST /api/v1/cinema/documents` — Submit CBFC, Distribution, and NOC compliance certificates

### Super Admin Operations
- `POST /api/v1/admin/verify-root-key` — Verify master key (`TIX-098-245`) and receive signed admin token
- `GET  /api/v1/admin/pending` — List pending cinemas, compliance files, and movie submissions
- `POST /api/v1/admin/approve-movie/:id` — Approve and publish movie to public discovery

---

## 💻 Tech Stack Summary

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React, Canvas Confetti, OGL (WebGL)
- **Backend**: Node.js, Express.js, Supabase JS Client, Multer, Helmet, CORS, Zod, QR Code
- **Database**: Cloud PostgreSQL 15 (Supabase), Row-Level Security, Database Stored Functions
- **Email Service**: EmailJS REST API Integration
- **Hosting**: Vercel (Frontend SPA) + Render (Node.js Web Service)

---

## 📄 License
This project is licensed under the **ISC License**.
