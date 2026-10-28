from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, LogoutView, RegisterView, UserAdminViewSet, UserProfileView

router = DefaultRouter()
router.register("users", UserAdminViewSet, basename="user-admin")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("profile/", UserProfileView.as_view(), name="auth-profile"),
    path("", include(router.urls)),
]
