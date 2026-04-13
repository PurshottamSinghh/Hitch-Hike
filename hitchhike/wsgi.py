"""WSGI config for the Hitch-Hike project."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hitchhike.settings")

application = get_wsgi_application()
