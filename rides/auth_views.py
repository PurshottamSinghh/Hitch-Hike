from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.gis.geos import Point
from .serializers import RegisterSerializer, UserSerializer

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }

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
        username = request.data.get("username")
        password = request.data.get("password")
        
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
        
        # Mock SSO Check (skipped when DEBUG for local/dummy accounts)
        if not getattr(settings, "DEBUG", False):
            valid_domains = ["@rockets.utoledo.edu", "@utoledo.edu"]
            if not any(user.email.lower().endswith(domain) for domain in valid_domains):
                return Response(
                    {"error": "Login restricted to UToledo accounts."},
                    status=status.HTTP_403_FORBIDDEN
                )

        tokens = get_tokens_for_user(user)
        return Response({
            "tokens": tokens,
            "user": UserSerializer(user).data
        })

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

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
