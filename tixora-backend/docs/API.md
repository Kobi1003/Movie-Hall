# TIXORA Backend API Documentation

The TIXORA API provides a production-grade, concurrency-safe, role-governed movie ticket booking platform.

## Base URL
```
http://localhost:5000/api/v1
```

## System Separation
TIXORA strictly enforces the domain relationship:
```
Movie Provider -> Authorizes Movie -> for Verified Cinema -> on Specific Screen(s) -> during Dates -> in Format
        |
Cinema Owner -> Schedules Show -> Clones Seat Plan into ShowSeat Inventory
        |
Customer -> 3-Minute Atomic Seat Hold -> Checkout -> Payment Verification -> Confirmed Booking -> Digital QR Ticket
```

---

## 1. Authentication Endpoints

### Register User
`POST /auth/signup`
```json
{
  "email": "customer@gmail.com",
  "password": "Password123!",
  "fullName": "Arjun Roy",
  "role": "CUSTOMER" // "CUSTOMER" | "CINEMA_OWNER" | "MOVIE_PROVIDER" | "PLATFORM_ADMIN"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "c1f76020-0000-0000-0000-000000000001",
      "email": "customer@gmail.com",
      "role": "CUSTOMER",
      "full_name": "Arjun Roy"
    },
    "token": "eyJhbGciOiJIUzI1Ni..."
  }
}
```

### Login
`POST /auth/login`
```json
{
  "email": "customer@gmail.com",
  "password": "Password123!"
}
```

---

## 2. Customer Movie & Cinema Discovery

### Discover Movies
`GET /movies?search=horizon&genre=Sci-Fi`

### Get Movie Details
`GET /movies/:movieId`

### Discover Cinemas
`GET /cinemas?city=Kolkata`

### Get Cinema Details
`GET /cinemas/:cinemaId`

### List Movie Shows
`GET /movies/:movieId/shows?date=2026-09-21&format=2D`

---

## 3. Interactive Seat Map & Distributed 3-Minute Hold

### Get Interactive Show Seat Map
`GET /shows/:showId/seat-map`

**Response:**
```json
{
  "success": true,
  "data": {
    "show": {
      "id": "show-uuid",
      "movie": "Movie XYZ",
      "cinema": "PQR Cinema",
      "screen": "Screen 1",
      "date": "2026-09-21",
      "time": "19:30:00",
      "format": "2D"
    },
    "seatPlan": {
      "version": 1,
      "screenPosition": "TOP"
    },
    "sections": [
      {
        "name": "Recliner Lounge",
        "seats": [
          {
            "id": "show-seat-uuid",
            "seatId": "A1",
            "row": "A",
            "number": 1,
            "x": 200,
            "y": 120,
            "seatType": "RECLINER",
            "price": 950,
            "status": "AVAILABLE",
            "heldByCurrentUser": false,
            "heldUntil": null
          }
        ]
      }
    ]
  }
}
```

### Temporarily Hold Seats (3-Minute TTL)
`POST /shows/:showId/hold`
```json
{
  "seatIds": ["show-seat-uuid-1", "show-seat-uuid-2"]
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Seats held successfully for 3 minutes",
  "data": {
    "holdId": "hold-uuid",
    "showId": "show-uuid",
    "seats": [
      { "id": "show-seat-uuid-1", "label": "A1", "price": 950, "status": "HELD" }
    ],
    "expiresAt": "2026-09-21T13:45:00.000Z",
    "durationSeconds": 180
  }
}
```

If seat is held by someone else:
```json
{
  "success": false,
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "One or more selected seats are no longer available."
  }
}
```

### Join FIFO Waiting Queue for Contested Seat
`POST /shows/:showId/seats/:showSeatId/queue`
```json
{
  "queueRequestId": "REQ_12345678",
  "position": 2,
  "status": "WAITING"
}
```

---

## 4. Bookings & Payments

### Create Idempotent Booking
`POST /bookings`
`Idempotency-Key: 7b3e102f-5374-4b55-a0d7-df4f6d338bfb`
```json
{
  "showId": "show-uuid",
  "holdId": "hold-uuid",
  "seatIds": ["show-seat-uuid-1"],
  "foodItems": [
    { "id": "fb-1", "name": "Caramel Truffle Popcorn", "qty": 1, "price": 320 }
  ]
}
```

### Confirm Payment & Issue Digital Ticket
`POST /payments/confirm`
```json
{
  "paymentId": "payment-uuid",
  "providerPaymentId": "PAY_98124912"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Payment verified and booking confirmed",
  "data": {
    "paymentStatus": "SUCCESS",
    "booking": {
      "booking": {
        "id": "booking-uuid",
        "booking_reference": "TXR-841921-2D",
        "status": "CONFIRMED",
        "payment_status": "PAID"
      },
      "ticket": {
        "ticket_number": "TIX-9A81CF21",
        "security_code": "SEC-8192",
        "gate_info": "Auditorium Gate 4 • Level 3",
        "qr_code_data": "data:image/png;base64,iVBORw0KGgo..."
      }
    }
  }
}
```

---

## 5. Cinema Management & Seat Studio

- `POST /cinema` — Register cinema
- `POST /cinema/verification` — Submit verification
- `POST /cinema/documents` — Upload licence / deed
- `POST /cinema/screens` — Create screen
- `POST /cinema/screens/:screenId/seat-plan/validate` — Validate seat layout geometry, overlaps, and duplicates
- `POST /cinema/screens/:screenId/seat-plan` — Save versioned layout
- `POST /cinema/screens/:screenId/seat-plan/publish` — Publish seat plan version
- `POST /cinema/shows` — Schedule authorized show (checks approved authorization, screen, dates, formats)
- `GET /cinema/shows/:showId/occupancy` — Real-time show capacity and occupancy metrics

---

## 6. Movie Provider APIs

- `POST /provider/movies` — Register film with CBFC metadata
- `POST /provider/authorizations` — Create exhibition authorization for verified cinema and screens
- `POST /provider/authorizations/:id/submit` — Submit authorization for admin approval

---

## 7. Platform Admin Console

- `GET /admin/dashboard` — Platform KPIs
- `POST /admin/cinema-verifications/:id/approve` — Approve cinema licence
- `POST /admin/authorizations/:id/approve` — Approve exhibition authorization
- `GET /admin/reservations` — Live active holds & FIFO queues inspector
- `GET /admin/audit-logs` — Audit log history
