from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "department", "department_name", "date_joined",
        ]
        # Users must not be able to promote themselves or move department
        # through the profile endpoint.
        read_only_fields = ["id", "username", "role", "department", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "password", "password_confirm", "role", "department",
        ]
        read_only_fields = ["id"]

    def validate_email(self, value):
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        validate_password(attrs["password"], user=User(username=attrs.get("username", "")))

        # Public sign-up always yields a viewer. Only an authenticated admin may
        # assign a role or department when creating an account.
        request = self.context.get("request")
        acting = getattr(request, "user", None)
        is_admin = bool(acting and acting.is_authenticated and acting.is_admin_role)
        if not is_admin:
            attrs["role"] = User.Role.VIEWER
            attrs.pop("department", None)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class AdminUserSerializer(serializers.ModelSerializer):
    """Admin-only view for listing users and changing role/department/active."""

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "department", "is_active", "date_joined",
        ]
        read_only_fields = ["id", "username", "date_joined"]


class LoginSerializer(TokenObtainPairSerializer):
    """Return access + refresh tokens together with the user's profile."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserProfileSerializer(self.user).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
