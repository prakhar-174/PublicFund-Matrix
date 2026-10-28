from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class BudgetUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Budget access", {"fields": ("role", "department")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Budget access", {"fields": ("role", "department")}),)
    list_display = ("username", "email", "role", "department", "is_active")
    list_filter = UserAdmin.list_filter + ("role",)
