"""
Django settings for the Hitch-Hike project.

Loads sensitive configuration from a .env file via django-environ.
Uses PostGIS as the spatial database backend via Neon PostgreSQL.
"""

import os
from pathlib import Path

import environ

# ---------------------------------------------------------------------------
# Path & environment setup
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CAMPUS_EMAIL_DOMAINS=(list, ["@rockets.utoledo.edu", "@utoledo.edu"]),
    FRONTEND_BASE_URL=(str, "http://localhost:5173"),
    MICROSOFT_TENANT_ID=(str, "organizations"),
    MICROSOFT_CLIENT_ID=(str, ""),
    MICROSOFT_CLIENT_SECRET=(str, ""),
    MICROSOFT_REDIRECT_URI=(str, "http://localhost:8000/api/rides/auth/microsoft/callback/"),
)

# Read the .env file located at the project root
environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

# ---------------------------------------------------------------------------
# Core settings
# ---------------------------------------------------------------------------
SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = ["*"]
CAMPUS_EMAIL_DOMAINS = [domain.lower() for domain in env("CAMPUS_EMAIL_DOMAINS")]
FRONTEND_BASE_URL = (env("FRONTEND_BASE_URL") or "").strip() or "http://localhost:5173"
MICROSOFT_TENANT_ID = env("MICROSOFT_TENANT_ID")
MICROSOFT_CLIENT_ID = env("MICROSOFT_CLIENT_ID")
MICROSOFT_CLIENT_SECRET = env("MICROSOFT_CLIENT_SECRET")
MICROSOFT_REDIRECT_URI = (
    (env("MICROSOFT_REDIRECT_URI") or "").strip()
    or "http://localhost:8000/api/rides/auth/microsoft/callback/"
)

# ---------------------------------------------------------------------------
# Mapbox API
# ---------------------------------------------------------------------------
MAPBOX_SECRET_TOKEN = env("MAPBOX_SECRET_TOKEN")

# ---------------------------------------------------------------------------
# Application definition
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Spatial support
    "django.contrib.gis",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    # Local apps
    "matching.apps.MatchingConfig",
    "rides.apps.RidesConfig",
    "gamification.apps.GamificationConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "hitchhike.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "hitchhike.wsgi.application"

# ---------------------------------------------------------------------------
# Database — PostGIS via Neon
# ---------------------------------------------------------------------------
# NOTE: PostGIS extension must be enabled on your Neon database.
# Run this once via psql or the Neon SQL editor:
#     CREATE EXTENSION IF NOT EXISTS postgis;
# ---------------------------------------------------------------------------
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        engine="django.contrib.gis.db.backends.postgis",
    ),
}

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Custom user model (placeholder — teammates will own this)
# ---------------------------------------------------------------------------
# AUTH_USER_MODEL = "users.User"

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/New_York"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------
STATIC_URL = "static/"

# ---------------------------------------------------------------------------
# Default primary key field type
# ---------------------------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "rest_framework.views.exception_handler",
}

# ---------------------------------------------------------------------------
# Simple JWT Configuration
# ---------------------------------------------------------------------------
from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOW_ALL_ORIGINS = True  # For development
