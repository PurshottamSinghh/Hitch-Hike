# Hitch-Hike: Project Overview & Architecture Guide

## 🚀 Current Stage of the Product
Hitch-Hike is currently in **Beta Testing / Pre-Production** state. 
We have successfully completed a major architectural overhaul. The old Next.js/Vanilla CSS frontend was decoupled and completely discarded in favor of a new, highly responsive Single Page Application (SPA) built with React 19, Vite, TanStack Router, Tailwind CSS, and Shadcn UI. 

Crucially, **the frontend is now 100% wired into the live PostgreSQL/Django backend**. Hardcoded mock data has been stripped out. The application facilitates real user authentication, stores dynamic data in the database, performs true geospatial ride-matching via PostGIS, and successfully simulates real-time driver dispatching.

## 🛠️ Key Changes Implemented So Far
1. **Frontend UI Replacement:** Integrated a premium, glassmorphic UI using Tailwind CSS and components designed to provide a native-app-like mobile-first experience.
2. **Backend API Integration:** Swapped out local static arrays for dynamic `fetch` points in `frontend/src/lib/api.ts`, connecting directly to the Django server.
3. **Database & Infrastructure Stability:** Transitioned the local environment to rely on `docker-compose`, stabilizing complex `GDAL` and `PostGIS` system dependencies.
4. **Real-Time Polling & WebSockets:** Implemented TanStack React Query (`useQuery`) with `refetchInterval` overrides to enable seamless 3-second polling on the Driver Dashboard and the Active Ride Live Map (fetching driver coordinates in near-real-time).
5. **Strict Typings & Linting:** Fixed all implicit `any` TypeScript rules, mapped data payloads correctly, configured Vite to properly proxy `/api`, and standardized ESLint + Prettier.

---

## 📂 Workspace Folder & File Breakdown

### 1. Root Level Infrastructure
*   **`docker-compose.yml`**: Defines the local multi-container network. Services include `db` (PostgreSQL + PostGIS) and `web` (Django Backend). It orchestrates spinning up the entire backend stack seamlessly.
*   **`Dockerfile`**: Defines the specific build instructions for the Django `web` container, ensuring the Python 3.12 environment has `psycopg2`, `gdal-bin`, and all libraries required for geospatial math.
*   **`requirements.txt`**: The Python pip dependency list (Django, djangorestframework, djangorestframework-simplejwt, psycogp2, etc).
*   **`.env`**: Contains local environment secrets, Mapbox API tokens, and database credentials (NEVER commit to public source control).

---

### 2. `/frontend` Directory (Client-Side SPA)
This is the Vite + React client. Everything the user sees and interacts with lives here.

*   **`vite.config.ts`**: The Vite compiler config. Notably contains the `server.proxy` object which captures any web request to `/api` and secretly reroutes it to `http://127.0.0.1:8000` (Django) to bypass local CORS errors.
*   **`tsconfig.json` & `eslint.config.js`**: Govern the strict rules for code syntax and formatting. Ensures developers aren't pushing broken code.
*   **`src/router.tsx` & `src/routeTree.gen.ts`**: The core logic for TanStack Router. It automatically builds exact paths (e.g. `"/groups"`, `"/discover"`) by parsing the `src/routes/` folder.

#### `frontend/src/` Subfolders
*   **`routes/`**: Contains the physical pages of the app.
    *   `onboarding.tsx`: Registration & Login flow (connects to `/api/rides/auth/`).
    *   `home.tsx`: The Driver Dashboard. Contains the polling logic for intercepting incoming ride requests via the `DispatchModal`.
    *   `discover.tsx`: The Rider Dashboard. Displays the list of available active matched rides.
    *   `ride.$rideId.tsx`: The dynamic Live Tracking screen. Uses `mapbox-gl` to plot real-time driver coordinates on a map.
    *   `groups.tsx` & `rewards.tsx`: The gamification views displaying University Leaderboards and AI-generated Carpool Groups.
*   **`components/`**: Reusable generic blocks (Buttons, Dialogs, Ride Cards) assembled to make the routes.
    *   `dispatch-modal.tsx`: The popup the driver sees when a rider requests them.
    *   `ride-card.tsx`: The standardized UI box detailing a driver, match score, and destination.
    *   `ui/`: Base shadcn-ui elements (buttons, inputs, accordions, avatars).
*   **`lib/api.ts`**: The most critical file in the frontend. It is the centralized "Data Bridge." Every time a React component needs data, it calls a function in `api.ts`, which then hits the Django backend using the JWT token stored in browser memory. Unifies API logic.
*   **`lib/utils.ts`**: Helper functions (like formatting time timestamps and merging Tailwind CSS dynamic classes).
*   **`styles.css`**: Contains the root CSS variables (Colors, Glassmorphism, Animations) consumed globally by Tailwind.

---

### 3. Backend Django Engine (Python)

#### `/hitchhike` (The Core settings)
*   **`settings.py`**: The central brain of the backend. Defines the connection to PostgreSQL, registers installed Apps (`rides`, `matching`, etc.), configures SimpleJWT permissions, and handles security logic.
*   **`urls.py`**: The master DNS directory. Defines what app handles which `/api/X` routes.

#### `/rides` (Auth & User Management)
*   **`models.py`**: Defines the `UserProfile` (Driver/Rider roles, vehicle specs) and `RideRequest` definitions in PostgreSQL.
*   **`auth_views.py` & `views.py`**: Contains the specific logic executing when a user attempts to log in, register, switch accounts, or manually list ride configurations.
*   **`urls.py`**: Routes defining the `/api/rides/...` endpoints.

#### `/matching` (Geospatial Ride Algorithms)
*   **`models.py`**: Contains `RideOffer` logic. 
*   **`services.py`**: Where the backend magic happens. Calculates the geographical intersection between a Driver's Route and a Rider's Route using `django.contrib.gis` (PostGIS spatial queries) to calculate match percentages dynamically.

#### `/gamification` (Social & Rewards)
*   **`models.py`**: Defines the data rules for `CarpoolGroup` (Groups) and `Leaderboard` metrics.
*   **`ai_services.py`**: Background tooling simulating data hooks for AI capabilities (e.g. auto-naming a group "Westgate Wake-Ups").
*   **`views.py`**: Endpoints responsible for aggregating user streaks, carbon emission stats (`co2SavedKg`), and monetary savings for the frontend `rewards.tsx` view.
