from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.contrib.gis.geos import Point
from django.conf import settings
from django.core import signing
from django.shortcuts import redirect
from django.utils.crypto import get_random_string
from urllib.parse import urlencode
import requests
from .serializers import RegisterSerializer, UserSerializer, ProfileUpdateSerializer
from .auth_utils import is_campus_email

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def _build_frontend_redirect(next_path: str, payload: dict[str, str]):
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    safe_next = next_path if isinstance(next_path, str) and next_path.startswith("/") else "/"
    fragment = urlencode(payload)
    return f"{base}{safe_next}#{fragment}"


def _unique_username_from_email(email: str):
    base = email.split("@")[0].replace(".", "_").replace("-", "_")[:120] or "student"
    candidate = base
    suffix = 1
    while User.objects.filter(username__iexact=candidate).exists():
        candidate = f"{base}_{suffix}"
        suffix += 1
    return candidate

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = get_tokens_for_user(user)
        return Response({
            "tokens": tokens,
            "user": UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)

class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        # We use SimpleJWT's serializer to handle both username and email if configured,
        # otherwise we manually check.
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        if not username or not password:
            return Response({"error": "Username/email and password are required."}, status=400)
        
        from django.contrib.auth import authenticate
        user = authenticate(username=username, password=password)
        
        # Fallback: Check if they provided email instead of username
        if user is None and "@" in username:
            try:
                user_obj = User.objects.get(email__iexact=username)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass

        if user is None:
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        
        if not is_campus_email(user.email):
            return Response(
                {"error": "Login restricted to UToledo accounts."},
                status=status.HTTP_403_FORBIDDEN
            )

        tokens = get_tokens_for_user(user)
        return Response({
            "tokens": tokens,
            "user": UserSerializer(user).data
        })


class MicrosoftAuthStartView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        next_path = request.GET.get("next", "/")
        if not next_path.startswith("/"):
            next_path = "/"
        redirect_uri = (settings.MICROSOFT_REDIRECT_URI or "").strip()
        if not redirect_uri:
            target = _build_frontend_redirect(
                next_path, {"oauth_error": "Microsoft callback URL is missing on the server."}
            )
            return redirect(target)
        if not settings.MICROSOFT_CLIENT_ID or not settings.MICROSOFT_CLIENT_SECRET:
            target = _build_frontend_redirect(
                next_path, {"oauth_error": "Microsoft SSO is not configured on the server."}
            )
            return redirect(target)

        state = signing.dumps(
            {"next": next_path, "nonce": get_random_string(24)},
            salt="microsoft-oauth-state",
        )
        authorize_url = (
            f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize"
        )
        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "response_mode": "query",
            "scope": "openid profile email User.Read",
            "state": state,
        }
        return redirect(f"{authorize_url}?{urlencode(params)}")


class MicrosoftAuthCallbackView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        raw_state = request.GET.get("state", "")
        auth_code = request.GET.get("code")
        auth_error = request.GET.get("error")

        try:
            state_data = signing.loads(raw_state, salt="microsoft-oauth-state", max_age=600)
        except signing.BadSignature:
            target = _build_frontend_redirect("/", {"oauth_error": "Invalid or expired sign-in state."})
            return redirect(target)

        next_path = state_data.get("next", "/")

        if auth_error:
            target = _build_frontend_redirect(next_path, {"oauth_error": "Microsoft sign-in was cancelled."})
            return redirect(target)

        if not auth_code:
            target = _build_frontend_redirect(next_path, {"oauth_error": "Missing Microsoft authorization code."})
            return redirect(target)

        token_url = (
            f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/token"
        )
        token_payload = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": auth_code,
            "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
            "scope": "openid profile email User.Read",
        }
        try:
            token_res = requests.post(token_url, data=token_payload, timeout=15)
            token_res.raise_for_status()
            token_data = token_res.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise ValueError("Missing access token from Microsoft.")

            userinfo_res = requests.get(
                "https://graph.microsoft.com/oidc/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=15,
            )
            userinfo_res.raise_for_status()
            userinfo = userinfo_res.json()
        except Exception:
            target = _build_frontend_redirect(
                next_path, {"oauth_error": "Microsoft sign-in failed during token exchange."}
            )
            return redirect(target)

        email = (
            userinfo.get("email")
            or userinfo.get("preferred_username")
            or userinfo.get("upn")
            or ""
        ).strip().lower()
        if not is_campus_email(email):
            target = _build_frontend_redirect(
                next_path, {"oauth_error": "Only UToledo campus Microsoft accounts are allowed."}
            )
            return redirect(target)

        first_name = userinfo.get("given_name", "")
        last_name = userinfo.get("family_name", "")
        full_name = userinfo.get("name", "").strip()

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            username = _unique_username_from_email(email)
            user = User.objects.create_user(
                username=username,
                email=email,
                password=None,
                first_name=first_name,
                last_name=last_name,
            )
            user.set_unusable_password()
            user.save()
        else:
            updates = []
            if first_name and user.first_name != first_name:
                user.first_name = first_name
                updates.append("first_name")
            if last_name and user.last_name != last_name:
                user.last_name = last_name
                updates.append("last_name")
            if updates:
                user.save(update_fields=updates)

        if full_name and not user.first_name and not user.last_name:
            parts = full_name.split(" ", 1)
            user.first_name = parts[0]
            if len(parts) > 1:
                user.last_name = parts[1]
            user.save(update_fields=["first_name", "last_name"])

        tokens = get_tokens_for_user(user)
        target = _build_frontend_redirect(
            next_path,
            {"access": tokens["access"], "refresh": tokens["refresh"], "oauth_provider": "microsoft"},
        )
        return redirect(target)

class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return ProfileUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        partial = kwargs.pop("partial", True)
        serializer = self.get_serializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "username" in data:
            user.username = data["username"]
        if "email" in data:
            user.email = data["email"]
        user.save()

        profile = user.profile
        if "role" in data:
            profile.role = data["role"]
        if "home_address" in data:
            profile.home_address = data["home_address"]
        if "phone_number" in data:
            profile.phone_number = data["phone_number"]
        profile.save()

        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)

class UpdateLocationView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        lat = request.data.get("latitude")
        lng = request.data.get("longitude")
        if lat is None or lng is None:
            return Response({"error": "Latitude and longitude required"}, status=400)
        
        user = request.user
        user.profile.current_location = Point(float(lng), float(lat))
        user.profile.is_online = True
        user.profile.save()
        
        return Response({"status": "location updated"})
