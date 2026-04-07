from django.urls import path
from . import views

urlpatterns = [
    path("api/register",                      views.register,         name="register"),
    path("api/login",                         views.login,            name="login"),
    path("api/logout",                        views.logout,           name="logout"),
    path("api/profile/<str:username>",        views.get_profile,      name="get_profile"),
    path("api/profile/<str:username>/email",  views.update_email,     name="update_email"),
    path("api/profile/<str:username>/password", views.update_password, name="update_password"),
]