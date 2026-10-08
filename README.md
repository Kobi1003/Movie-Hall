🎬 TIXORA — Modern Cinema Ticketing & Hall Management System
Tixora is an end-to-end cinema ticket booking platform that bridges moviegoers and theater operators. It is designed to handle high-concurrency ticket drops with zero race conditions while delivering a fast, dark-glassmorphism user experience.

🌟 Core Highlights:
Zero-Race-Condition Seat Reservation Engine:
Uses Redis distributed locking combined with PostgreSQL atomic RPC procedures (claim_show_seats) to enforce a 180-second TTL seat hold.
Integrates RabbitMQ for asynchronous queue promotion, promoting waiting FIFO customers if an abandoned reservation expires.
Geospatial Theater Discovery:
Integrated with Google Maps Geocoding API and a client/server Haversine proximity engine that sorts cinema halls by distance from the user’s selected city or live location.
Cinema Hall Provider Studio:
Film creators and hall managers can upload custom movie posters (PNG/JPG/WEBP) or link direct media URLs.
Real-time theatrical card previews with release dates, suggested showtimes, and producer credits.
Draft and publishing lifecycles alongside legal certificate validation (CBFC & distribution rights).
Instant Digital QR Passes:
Cryptographically verified dynamic QR passes generated on order confirmation for quick on-site scanning.
Cyber-Cinema Glassmorphic Aesthetics:
Built with React 19, Tailwind CSS v4, and custom WebGL shader particles (OGL) for a fluid, dark-mode visual feel.
