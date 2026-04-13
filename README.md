# Hitch-Hike

Hitch-Hike is a Django REST backend for a campus carpool matching system. The project focuses on matching rider requests to driver offers, ranking candidates by detour time, and confirming rides safely with database transactions.

## What This Project Does

- Stores users, ride offers, and ride requests.
- Ranks matching ride offers for a rider using the Mapbox Matrix API.
- Confirms matches while preventing double-booking with row-level locking.
- Exposes read-only ride list and detail endpoints for confirmed rides.

## Tech Stack

- Python 3.12 recommended
- Django 4.2
- Django REST Framework
- PostgreSQL with PostGIS
- Mapbox Matrix API

## Project Structure

```text
Hitch-Hike/
|-- hitchhike/         # Django project settings, root URLs, test settings
|-- matching/          # Matching engine, ride model, serializers, API views, tests
|-- users/             # Custom user model plus placeholder ride offer/request models
|-- manage.py
|-- requirements.txt
|-- gdal_install.txt   # Windows setup notes for GDAL/PostGIS support
|-- CHANGELOG.md
```

## Prerequisites

Before running the app locally, make sure you have:

- Python installed
- PostgreSQL database access
- PostGIS enabled on that database
- A Mapbox access token

If you are developing on Windows, `gdal_install.txt` includes local setup notes for GeoDjango dependencies.

## Environment Variables

Create a `.env` file in the project root with these values:

```env
MAPBOX_SECRET_TOKEN=your_mapbox_token
DATABASE_URL=postgresql://username:password@host:port/dbname?sslmode=require
SECRET_KEY=your_django_secret_key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

Notes:

- `DATABASE_URL` should point to a PostgreSQL database with the PostGIS extension enabled.
- `MAPBOX_SECRET_TOKEN` is used by the matching engine when calling the Mapbox Matrix API.
- Do not commit real credentials.

## Setup

1. Create and activate a virtual environment.
2. Install dependencies.
3. Add your `.env` file.
4. Run migrations.
5. Start the development server.

Example commands:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

## Database Notes

The default application settings use the PostGIS backend:

- Django GIS support is enabled in `INSTALLED_APPS`
- The database engine is `django.contrib.gis.db.backends.postgis`

Enable PostGIS once on your database:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## API Endpoints

All matching routes are mounted under `/api/matching/`.

### Rank Matches

`GET /api/matching/rank/<ride_request_id>/`

Returns available ride offers ranked by smallest detour.

Example response shape:

```json
{
  "ride_request_id": 42,
  "matches": [
    {
      "ride_offer_id": 7,
      "driver_name": "Alice Smith",
      "departure_time": "2026-04-07T08:00:00-04:00",
      "available_seats": 3,
      "original_duration": 1200.0,
      "detoured_duration": 1450.0,
      "extra_seconds": 250.0
    }
  ]
}
```

### Confirm Match

`POST /api/matching/confirm/`

Confirms a match between a ride offer and a ride request.

Example request body:

```json
{
  "ride_offer_id": 7,
  "ride_request_id": 42
}
```

This operation:

- locks the related ride offer and ride request rows
- prevents double-booking
- decrements available seats
- marks the request as matched
- creates or updates a `Ride` record

### List Rides

`GET /api/matching/rides/`

Returns all rides.

### Ride Detail

`GET /api/matching/rides/<pk>/`

Returns a single ride by primary key.

## Testing

This project includes a dedicated test settings module for local testing without GDAL, SpatiaLite, or PostGIS.

Tests use:

- in-memory SQLite
- mocked Mapbox API calls
- GIS field fallbacks in model code

Run the matching test suite with:

```powershell
python manage.py test matching --settings=hitchhike.test_settings
```

## Current Implementation Notes

- `users/models.py` contains placeholder `RideOffer` and `RideRequest` models so the matching feature can run independently.
- `matching/services.py` contains the core ranking and confirmation business logic.
- `matching/tests.py` covers ranking, confirm-match behavior, and API endpoint responses.

## Known Constraints

- Live ranking depends on the Mapbox Matrix API being available.
- Production usage expects a PostgreSQL/PostGIS database.
- Some user and ride-related models are marked as placeholders and may be replaced as the wider project is integrated.

## Helpful Files

- `gdal_install.txt`: Windows notes for GIS dependency setup
- `CHANGELOG.md`: project change history
