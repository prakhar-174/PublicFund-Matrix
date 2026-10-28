from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdminUser(BasePermission):
    """Allow only users whose role is 'admin' (or Django superusers)."""

    message = "Administrator role required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin_role)


class IsAdminOrReadOnly(BasePermission):
    """Any authenticated user may read; only admins may write."""

    message = "Administrator role required to modify this resource."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return request.method in SAFE_METHODS or user.is_admin_role


class IsAdminOrAnalystOrReadOnly(BasePermission):
    """Any authenticated user may read; only admins and analysts may write."""

    message = "Your role does not permit modifying budget data."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.can_write


class IsAdminOrAnalyst(BasePermission):
    """Analysts and admins only (used for compute-heavy or bulk-write endpoints)."""

    message = "Analyst or administrator role required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.can_write)
