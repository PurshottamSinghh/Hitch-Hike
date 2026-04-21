# Hitch-Hike: Uber-Style Dispatch System

Hitch-Hike is a full-stack campus carpool dispatch engine. It connects Riders with nearby Drivers in real-time, featuring automated matching, Mapbox-powered route tracking, and a secure Django REST backbone.

> [!TIP]
> **New to Hitch-Hike?** Check out our [Full User Guide](./USER_GUIDE.md) for a detailed walkthrough of Rider and Driver workflows.

## 🚀 Quick Start (Zero-Config)

The fastest way to run the **whole app** is via Docker. This will spin up the Frontend, Backend, and a local PostGIS Database automatically.

```bash
# 1. Clone and Navigate
git clone https://github.com/PurshottamSinghh/Hitch-Hike.git
cd Hitch-Hike

# 2. Start all services
docker-compose up --build -d

# 3. Seed Demo Data (Admin, Drivers, Riders)
docker-compose exec backend python manage.py seed_demo_data
```

Once all containers are healthy:
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Database**: Local PostGIS on port `5432`

## 🏗️ Architecture

- **Backend**: Django REST Framework + PostGIS (PostgreSQL)
- **Frontend**: Next.js 16 (Turbopack) + Vanilla CSS (Glassmorphism UI)
- **Database**: PostgreSQL with PostGIS extension for geospatial queries.
- **Geospatial**: Mapbox Directions & Matrix APIs.

## 🔑 Environment Variables

You must create a `.env` file in the project root with your Mapbox tokens:

```env
# Mapbox Tokens
MAPBOX_SECRET_TOKEN=sk.xxx...
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx...

# Django Settings
SECRET_KEY=your-secure-key
ALLOWED_HOSTS=localhost,127.0.0.1
DEBUG=True

# Campus Auth
CAMPUS_EMAIL_DOMAINS=@rockets.utoledo.edu,@utoledo.edu

# Microsoft OAuth (Outlook / Azure AD SSO)
FRONTEND_BASE_URL=http://localhost:5173
MICROSOFT_TENANT_ID=organizations
MICROSOFT_CLIENT_ID=your-azure-app-client-id
MICROSOFT_CLIENT_SECRET=your-azure-app-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:8000/api/rides/auth/microsoft/callback/
```

> [!NOTE]
> By default, `docker-compose` uses the local database service. To use an external database (like Neon), update the `DATABASE_URL` in your `.env` file and restart.

## 🛤️ The User Flow

### 1. The Rider Experience
1. **Search**: Enter a destination on the interactive map.
2. **Dispatch**: Click "Request Ride". The system broadcasts the request to all online drivers.
3. **Tracking**: Once accepted, see the Driver approaching in real-time with an approach route drawn on the map.

### 2. The Driver Experience
1. **Go Online**: Flip the status switch to start receiving broadcasts.
2. **Accept**: A modal pops up when a nearby rider is found.
3. **Navigation**: Upon acceptance, the UI transforms into a Navigation Mode, showing the path to the Rider's pickup location.
4. **Complete**: Pick up the rider and mark the trip as completed.

## 🛠️ Tech Stack Deep Dive

### Automated Dispatch Engine
Instead of manual picking, Hitch-Hike uses a **Broadcast & Match** model.
- **Pending**: Request is visible to all active drivers.
- **Accepted**: Locked to a specific driver; status updates globally.
- **Active**: Lifecycle tracking with Mapbox route lines.
- **Completed**: Trip ends, driver returns to the pool.

---
## 📄 Project Structure
- `hitchhike/`: Project configuration and settings.
- `rides/`: Core dispatch logic and model state.
- `matching/`: Geospatial ranking algorithms.
- `frontend/`: Next.js web application.
- `docker-compose.yml`: Full-stack orchestration.
