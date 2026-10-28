from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        ANALYST = "analyst", "Budget Analyst"
        VIEWER = "viewer", "Viewer"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.VIEWER)
    # String reference: Department lives in the budgets app, which in turn
    # references this model (BudgetAllocation.approved_by).
    department = models.ForeignKey(
        "budgets.Department",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="staff",
    )

    class Meta:
        ordering = ["username"]

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def is_admin_role(self) -> bool:
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def can_write(self) -> bool:
        """Admins and analysts may modify budget data; viewers are read-only."""
        return self.is_admin_role or self.role == self.Role.ANALYST
