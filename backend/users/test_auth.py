import pytest
from django.contrib.auth import get_user_model

User = get_user_model()
PASSWORD = "Str0ng-pass-123"


def register(client, **overrides):
    payload = {"username": "newbie", "email": "n@example.com", "password": PASSWORD,
               "password_confirm": PASSWORD, **overrides}
    return client.post("/api/auth/register/", payload, format="json")


@pytest.mark.django_db
class TestRegistration:
    def test_public_registration_creates_viewer(self, anon):
        res = register(anon)
        assert res.status_code == 201
        assert res.data["role"] == "viewer"
        assert "password" not in res.data

    def test_public_registration_cannot_self_assign_admin(self, anon):
        res = register(anon, role="admin")
        assert res.status_code == 201
        assert User.objects.get(username="newbie").role == "viewer"

    def test_admin_can_assign_role(self, admin_client):
        res = register(admin_client, role="analyst")
        assert res.status_code == 201
        assert res.data["role"] == "analyst"

    def test_password_mismatch_and_weak_password_rejected(self, anon):
        assert register(anon, password_confirm="different").status_code == 400
        assert register(anon, password="12345678", password_confirm="12345678").status_code == 400

    def test_duplicate_email_rejected(self, anon):
        assert register(anon).status_code == 201
        assert register(anon, username="other").status_code == 400


@pytest.mark.django_db
class TestLoginLogout:
    def test_login_returns_tokens_and_user(self, anon, analyst_user):
        res = anon.post("/api/auth/login/", {"username": "u_analyst", "password": PASSWORD}, format="json")
        assert res.status_code == 200
        assert {"access", "refresh", "user"} <= set(res.data)
        assert res.data["user"]["role"] == "analyst"

    def test_bad_credentials_rejected(self, anon, analyst_user):
        res = anon.post("/api/auth/login/", {"username": "u_analyst", "password": "wrong"}, format="json")
        assert res.status_code == 401

    def test_logout_blacklists_refresh_token(self, anon, analyst_user):
        tokens = anon.post("/api/auth/login/", {"username": "u_analyst", "password": PASSWORD}, format="json").data
        anon.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        assert anon.post("/api/auth/logout/", {"refresh": tokens["refresh"]}, format="json").status_code == 205
        anon.credentials()
        refreshed = anon.post("/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json")
        assert refreshed.status_code == 401

    def test_logout_requires_authentication(self, anon):
        assert anon.post("/api/auth/logout/", {"refresh": "x"}, format="json").status_code == 401

    def test_login_is_rate_limited(self, anon, settings):
        from rest_framework.settings import api_settings
        from rest_framework.throttling import ScopedRateThrottle

        ScopedRateThrottle.THROTTLE_RATES = {**api_settings.DEFAULT_THROTTLE_RATES, "auth": "3/min"}
        try:
            codes = [anon.post("/api/auth/login/", {"username": "x", "password": "y"}, format="json").status_code
                     for _ in range(5)]
        finally:
            ScopedRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
        assert codes[-1] == 429


@pytest.mark.django_db
class TestProfileAndPermissions:
    def test_profile_requires_authentication(self, anon):
        assert anon.get("/api/auth/profile/").status_code == 401

    def test_profile_returns_current_user(self, viewer_client):
        res = viewer_client.get("/api/auth/profile/")
        assert res.status_code == 200 and res.data["username"] == "u_viewer"

    def test_user_cannot_change_own_role(self, viewer_client, viewer_user):
        viewer_client.patch("/api/auth/profile/", {"role": "admin", "first_name": "Vee"}, format="json")
        viewer_user.refresh_from_db()
        assert viewer_user.role == "viewer" and viewer_user.first_name == "Vee"

    def test_user_admin_endpoint_is_admin_only(self, viewer_client, analyst_client, admin_client):
        assert viewer_client.get("/api/auth/users/").status_code == 403
        assert analyst_client.get("/api/auth/users/").status_code == 403
        assert admin_client.get("/api/auth/users/").status_code == 200

    def test_admin_can_change_role(self, admin_client, viewer_user):
        res = admin_client.patch(f"/api/auth/users/{viewer_user.id}/", {"role": "analyst"}, format="json")
        assert res.status_code == 200
        viewer_user.refresh_from_db()
        assert viewer_user.role == "analyst"
