# Hitch-Hike — Changelog

All notable changes to the **Ride Matching & Coordination** module are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.0.0] — 2026-04-14

### Added — Frontend Prototype (React / Next.js / Mapbox)

Scaffolded in `frontend/` using **Next.js 16**, **Tailwind CSS v4**, **Mapbox GL JS v3**, and **react-map-gl v8**.

#### Project Setup
| File | Purpose |
|------|---------|
| `frontend/package.json` | Next.js 16, react-map-gl/mapbox, mapbox-gl, lucide-react, Tailwind CSS v4 |
| `frontend/.env.local` | `NEXT_PUBLIC_MAPBOX_TOKEN` for client-side Mapbox access |
| `frontend/app/globals.css` | Design system: dark theme tokens, pulse animation, skeleton shimmer, driver markers |
| `frontend/app/layout.js` | Root layout with Inter font + Mapbox GL CSS via CDN `<link>` tags |

#### Custom Hooks
| Hook | File | Purpose |
|------|------|---------|
| `useUserLocation` | `hooks/useUserLocation.js` | Wraps `navigator.geolocation.getCurrentPosition` with loading/error/retry state |

#### Components
| Component | File | Purpose |
|-----------|------|---------|
| `Sidebar` | `components/Sidebar.jsx` | Desktop left rail (72px) + mobile bottom bar with 5 nav items |
| `ActionPanel` | `components/ActionPanel.jsx` | GPS-autofilled pickup, dropoff input, search button, idle/loading/results states |
| `MapView` | `components/MapView.jsx` | Dark Mapbox map, pulsing blue-dot, driver car markers, curved GeoJSON route line |
| `DriverCard` | `components/DriverCard.jsx` | Driver result card with avatar, info pills, accept-match button |
| `LoadingSkeleton` | `components/LoadingSkeleton.jsx` | 3 shimmer placeholder cards during search loading |

#### Main Page (`app/page.js`)
- State machine: `idle` → `loading` (1.5s skeleton) → `results` (3 dummy drivers)
- Dummy drivers positioned relative to user's GPS coordinates
- Click driver card → draws curved Bezier route on map
- Accept match → button transitions to "✓ Matched" state

#### Design Highlights
- Dark glassmorphic theme with indigo/purple gradient accents
- Pulsing blue-dot marker for live user location
- Driver markers with gradient backgrounds and hover scale
- Route line with glow layer + dashed main line
- Responsive: 45vh panel on mobile, 380–420px fixed sidebar on desktop

### Run Command
```bash
cd frontend && npm run dev
# → http://localhost:3000
```

---

## [1.1.0] — 2026-04-06


### Added — Test Suite

- **`matching/tests.py`** — Comprehensive test suite with 20 test methods across 6 classes.
- **`hitchhike/test_settings.py`** — Test-specific settings using SpatiaLite in-memory DB.

#### Unit Tests (Testing `MatchingEngine` class)
| Class | Tests | Purpose |
|-------|-------|---------|
| `TestConfirmMatchStatusTransition` | 4 | Proves status transitions `pending` → `confirmed`, seat decrement, request marked matched, detour recorded |
| `TestConfirmMatchACIDCompliance` | 4 | Proves double-booking prevention: no seats → error, already matched → error, nonexistent IDs → error |
| `TestRankBestMatches` | 4 | Proves ranking returns sorted results, correct fields, and error handling for invalid requests |

#### Interface Tests (Testing REST API endpoints)
| Class | Tests | Purpose |
|-------|-------|---------|
| `TestConfirmMatchEndpoint` | 6 | `POST /api/matching/confirm/` — valid → 201, missing fields → 400, double confirm → 400 |
| `TestRankMatchesEndpoint` | 3 | `GET /api/matching/rank/<id>/` — valid → 200 with matches, nonexistent → 400 |
| `TestRideEndpoints` | 3 | `GET /api/matching/rides/` and `/rides/<pk>/` — list, detail, 404 handling |

### Technical Details
- All Mapbox API calls mocked via `@patch.object(MatchingEngine, "fetch_mapbox_distance_matrix")`
- Shared `_BaseTestMixin` provides consistent test data setup
- Run: `python manage.py test matching --settings=hitchhike.test_settings`

---

## [1.0.0] — 2026-04-06

### Added — Initial Backend (Functionality 3: Ride Matching & Coordination)

#### Project Configuration
| File | Purpose |
|------|---------|
| `.env` | Mapbox secret token, Neon PostgreSQL `DATABASE_URL`, Django `SECRET_KEY` |
| `.gitignore` | Ignores `.env`, `__pycache__`, `*.pyc`, `db.sqlite3`, venvs, IDE files |
| `requirements.txt` | Django 4.2, DRF, django-environ, psycopg2-binary, requests, dj-database-url |
| `manage.py` | Standard Django CLI entrypoint |

#### Django Project Package (`hitchhike/`)
| File | Purpose |
|------|---------|
| `settings.py` | Loads `.env` via `django-environ`, configures PostGIS engine, DRF, registered apps |
| `urls.py` | Root routing: `/admin/` and `/api/matching/` |
| `wsgi.py` | WSGI application entrypoint |
| `asgi.py` | ASGI application entrypoint |

#### Placeholder Models (`users/` app)
| Model | Description |
|-------|-------------|
| `User` | Extends `AbstractUser` — stub for teammate implementation |
| `RideOffer` | Driver's ride offer: `PointField` origin/destination, `available_seats`, status, departure time |
| `RideRequest` | Rider's request: `PointField` pickup/dropoff, requested time, status |

#### Core Matching App (`matching/`)

##### `models.py` — Ride Model
| Field | Type | Purpose |
|-------|------|---------|
| `ride_offer` | `ForeignKey(RideOffer)` | Links to the driver's offer |
| `ride_requests` | `ManyToManyField(RideRequest)` | All riders assigned to this ride |
| `status` | `CharField` | Choices: `pending`, `confirmed`, `completed` |
| `actual_route` | `LineStringField(srid=4326)` | Geographic path of the ride |
| `total_detour_time` | `IntegerField` | Detour in seconds caused by pickups/dropoffs |

##### `services.py` — MatchingEngine
| Method | Description |
|--------|-------------|
| `fetch_mapbox_distance_matrix(coordinates)` | Calls Mapbox Matrix API, returns N×N duration matrix |
| `rank_best_matches(ride_request_id)` | Queries active offers, computes detour per offer, returns sorted list |
| `_compute_detour(offer, request)` | Calculates `(origin→pickup + pickup→dropoff + dropoff→dest) − (origin→dest)` |
| `confirm_match(ride_offer_id, ride_request_id)` | ACID-compliant confirmation using `select_for_update()` + `transaction.atomic()` |

##### `serializers.py` — DRF Serializers
| Serializer | Type | Purpose |
|------------|------|---------|
| `RideOfferSummarySerializer` | Nested read-only | Compact offer view with coordinate arrays |
| `RideRequestSummarySerializer` | Nested read-only | Compact request view with coordinate arrays |
| `RideSerializer` | Model serializer | Full Ride representation with nested details |
| `MatchResultSerializer` | Plain serializer | Ranked match result output |
| `ConfirmMatchSerializer` | Plain serializer | Confirm match input validation |

##### `views.py` — API Endpoints
| Method | URL | View Class | Description |
|--------|-----|------------|-------------|
| `GET` | `/api/matching/rank/<ride_request_id>/` | `RankMatchesView` | Ranked list of best matches |
| `POST` | `/api/matching/confirm/` | `ConfirmMatchView` | Confirm a match (ACID-locked) |
| `GET` | `/api/matching/rides/` | `RideListView` | Paginated ride list |
| `GET` | `/api/matching/rides/<pk>/` | `RideDetailView` | Single ride details |

##### `urls.py` — App Routing
- All paths mounted under `/api/matching/` via `hitchhike/urls.py`
- Namespace: `matching`

##### `admin.py` — Django Admin
- `Ride` model registered with list display, filters, and search

---

## [Unreleased]

_Future changes will be logged here before the next version tag._

### Planned
- [ ] Integration with teammate's real `User`, `RideOffer`, `RideRequest` models
- [ ] Authentication & permissions on API endpoints
- [ ] WebSocket notifications for real-time match updates
- [ ] Ride cancellation endpoint
- [ ] Route geometry storage (populate `actual_route` from Mapbox Directions API)
- [ ] Pagination tuning and rate limiting
