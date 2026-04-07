import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from user_auth import UserAuth
from user_profile import UserProfile

auth = UserAuth()
profiles = {}  # { username: UserProfile }


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    data = json.loads(request.body)
    username = data.get("username")
    password = data.get("password")
    email    = data.get("email")
    first    = data.get("first_name")
    last     = data.get("last_name")

    if not all([username, password, email, first, last]):
        return JsonResponse({"success": False, "message": "All fields required"}, status=400)

    if not auth.register(username, password, email):
        return JsonResponse({"success": False, "message": "Username taken or invalid password"}, status=409)

    profiles[username] = UserProfile(username, first, last, email)
    return JsonResponse({"success": True, "message": "Registered successfully"}, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    data = json.loads(request.body)
    username = data.get("username")
    password = data.get("password")

    if not auth.login(username, password):
        return JsonResponse({"success": False, "message": "Invalid credentials"}, status=401)

    return JsonResponse({"success": True, "message": f"Welcome, {username}!"}, status=200)


@csrf_exempt
@require_http_methods(["POST"])
def logout(request):
    data = json.loads(request.body)
    username = data.get("username")
    auth.logout(username)
    return JsonResponse({"success": True, "message": "Logged out"}, status=200)


@csrf_exempt
@require_http_methods(["GET"])
def get_profile(request, username):
    if not auth.is_logged_in(username):
        return JsonResponse({"success": False, "message": "Not logged in"}, status=401)

    profile = profiles.get(username)
    if not profile:
        return JsonResponse({"success": False, "message": "Profile not found"}, status=404)

    return JsonResponse({"success": True, "profile": profile.get_profile_info()}, status=200)


@csrf_exempt
@require_http_methods(["PUT"])
def update_email(request, username):
    if not auth.is_logged_in(username):
        return JsonResponse({"success": False, "message": "Not logged in"}, status=401)

    data = json.loads(request.body)
    new_email = data.get("email")

    if not profiles[username].update_email(new_email):
        return JsonResponse({"success": False, "message": "Invalid email"}, status=400)

    return JsonResponse({"success": True, "message": "Email updated"}, status=200)


@csrf_exempt
@require_http_methods(["PUT"])
def update_password(request, username):
    data = json.loads(request.body)
    old_pw = data.get("old_password")
    new_pw = data.get("new_password")

    if not auth.update_password(username, old_pw, new_pw):
        return JsonResponse({"success": False, "message": "Password update failed"}, status=400)

    return JsonResponse({"success": True, "message": "Password updated"}, status=200)