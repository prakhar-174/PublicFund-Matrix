from django.contrib.auth import get_user_model
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from audit.mixins import AuditedModelViewSetMixin
from audit.services import record

from .permissions import IsAdminUser
from .serializers import (
    AdminUserSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserProfileSerializer,
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    # Default JWT authentication still runs, so an admin's token is honoured
    # when they create accounts with a specific role; anonymous callers pass.

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        record(request.user, "register", "user", user.pk, {"username": user.username, "role": user.role}, request)
        return Response(UserProfileSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, AuthenticationFailed) as exc:
            # Username only; the attempted password is never stored.
            record(None, "login_failed", "user", "", {"username": str(request.data.get("username", ""))[:150]}, request)
            if isinstance(exc, TokenError):
                raise InvalidToken(exc.args[0])
            raise
        record(serializer.user, "login", "user", serializer.user.pk, {}, request)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            return Response({"detail": "Invalid or expired refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        record(request.user, "logout", "user", request.user.pk, {}, request)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class UserProfileView(AuditedModelViewSetMixin, generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user


class UserAdminViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    """Admin-only user management (list, change role/department, deactivate)."""

    queryset = User.objects.select_related("department").order_by("username")
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]
    http_method_names = ["get", "patch", "head", "options"]
    filterset_fields = ["role", "is_active", "department"]
    search_fields = ["username", "email", "first_name", "last_name"]
