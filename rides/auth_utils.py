from django.conf import settings


def get_allowed_campus_domains():
    configured = getattr(settings, "CAMPUS_EMAIL_DOMAINS", None)
    if isinstance(configured, (list, tuple)) and configured:
        return tuple(d.lower() for d in configured)
    return ("@rockets.utoledo.edu", "@utoledo.edu")


def is_campus_email(email: str) -> bool:
    if not email:
        return False
    normalized = email.strip().lower()
    return any(normalized.endswith(domain) for domain in get_allowed_campus_domains())

