import io
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command

from budgets.models import BudgetAllocation, Department, FiscalYear, PerformanceMetric, SpendingEntry

HEADER = "department_code,fiscal_year,allocated_amount,spent_amount,requested_amount,status\n"


def upload(client, text, name="budget.csv", **extra):
    f = SimpleUploadedFile(name, text.encode(), content_type="text/csv")
    return client.post("/api/import/budgets/", {"file": f, **extra}, format="multipart")


@pytest.mark.django_db
class TestImport:
    def test_creates_and_updates_in_bulk(self, analyst_client, world):
        csv = HEADER + "HLT,2025,500,450,600,\nEDU,2026-27,100,0,0,draft\n"
        FiscalYear.objects.create(year=2026)
        res = upload(analyst_client, csv)
        assert res.status_code == 201, res.data
        assert (res.data["created"], res.data["updated"]) == (1, 1)
        hlt = BudgetAllocation.objects.get(department__code="HLT", fiscal_year=world["fy25"])
        assert hlt.allocated_amount == Decimal("500.00")
        assert BudgetAllocation.objects.filter(department__code="EDU", fiscal_year__year=2026).exists()

    def test_row_level_errors_and_nothing_saved(self, analyst_client, world):
        before = BudgetAllocation.objects.count()
        csv = (HEADER + "HLT,2025,-5,0,0,\nXXX,2025,10,0,0,\nEDU,1999,10,0,0,\nENV,2025,abc,0,0,\n"
               ",2025,10,0,0,\nEDU,2025,10,0,0,bogus\n")
        res = upload(analyst_client, csv)
        assert res.status_code == 400
        assert res.data["rows_invalid"] == 6
        rows = {e["row"]: " ".join(e["errors"]) for e in res.data["errors"]}
        assert "negative" in rows[2] and "Unknown department_code" in rows[3] and "Unknown fiscal_year" in rows[4]
        assert "not a number" in rows[5] and "missing" in rows[6] and "status" in rows[7]
        assert BudgetAllocation.objects.count() == before

    def test_good_rows_not_saved_when_any_row_bad(self, analyst_client, world):
        res = upload(analyst_client, HEADER + "HLT,2025,999,0,0,\nXXX,2025,1,0,0,\n")
        assert res.status_code == 400
        assert BudgetAllocation.objects.get(department__code="HLT", fiscal_year=world["fy25"]).allocated_amount == 420

    def test_duplicates_within_file_detected(self, analyst_client, world):
        res = upload(analyst_client, HEADER + "HLT,2025,1,0,0,\nhlt,2025,2,0,0,\n")
        assert res.status_code == 400 and "Duplicate of row 2" in res.data["errors"][0]["errors"][0]

    def test_missing_columns_and_bad_file_type(self, analyst_client, world):
        assert "Missing required" in upload(analyst_client, "department_code,fiscal_year\nHLT,2025\n").data["detail"]
        assert upload(analyst_client, "x", name="evil.exe").status_code == 400
        assert analyst_client.post("/api/import/budgets/", {}, format="multipart").status_code == 400

    def test_cannot_import_as_approved_and_reimport_marks_revised(self, analyst_client, admin_client, world):
        assert upload(analyst_client, HEADER + "HLT,2025,1,0,0,approved\n").status_code == 400
        BudgetAllocation.objects.filter(department__code="HLT", fiscal_year=world["fy25"]).update(status="approved")
        upload(analyst_client, HEADER + "HLT,2025,430,0,0,\n")
        assert BudgetAllocation.objects.get(department__code="HLT", fiscal_year=world["fy25"]).status == "revised"

    def test_dry_run_saves_nothing(self, analyst_client, world):
        res = upload(analyst_client, HEADER + "HLT,2025,777,0,0,\n", dry_run="true")
        assert res.status_code == 200 and res.data["dry_run"] is True
        assert BudgetAllocation.objects.get(department__code="HLT", fiscal_year=world["fy25"]).allocated_amount == 420

    def test_viewer_forbidden_and_excel_supported(self, viewer_client, analyst_client, world):
        assert upload(viewer_client, HEADER + "HLT,2025,1,0,0,\n").status_code == 403
        import pandas as pd
        buf = io.BytesIO()
        pd.DataFrame([{"department_code": "HLT", "fiscal_year": 2025, "allocated_amount": 433}]).to_excel(buf, index=False)
        f = SimpleUploadedFile("b.xlsx", buf.getvalue())
        res = analyst_client.post("/api/import/budgets/", {"file": f}, format="multipart")
        assert res.status_code == 201, res.data


@pytest.mark.django_db
class TestSeed:
    def test_seed_loads_expected_shape_and_is_idempotent(self):
        call_command("seed_demo_data", stdout=io.StringIO())
        counts = (Department.objects.count(), FiscalYear.objects.count(), BudgetAllocation.objects.count(),
                  PerformanceMetric.objects.count(), SpendingEntry.objects.count())
        assert counts[:3] == (10, 3, 30)
        call_command("seed_demo_data", stdout=io.StringIO())
        assert counts == (Department.objects.count(), FiscalYear.objects.count(), BudgetAllocation.objects.count(),
                          PerformanceMetric.objects.count(), SpendingEntry.objects.count())

    def test_seed_data_is_consistent(self):
        call_command("seed_demo_data", stdout=io.StringIO())
        for alloc in BudgetAllocation.objects.prefetch_related("spending_entries"):
            assert sum(e.amount for e in alloc.spending_entries.all()) == alloc.spent_amount
        envr = Department.objects.get(code="ENVR")
        assert not PerformanceMetric.objects.filter(department=envr, fiscal_year__year=2025).exists()

    def test_seed_users_opt_in(self):
        call_command("seed_demo_data", stdout=io.StringIO())
        from django.contrib.auth import get_user_model
        assert not get_user_model().objects.filter(username="demo_admin").exists()
        call_command("seed_demo_data", "--with-users", stdout=io.StringIO())
        assert get_user_model().objects.filter(username="demo_admin", role="admin").exists()

    def test_optimizer_runs_on_seed_data(self):
        from budgets.services.optimizer import BudgetOptimizer
        call_command("seed_demo_data", stdout=io.StringIO())
        fy = FiscalYear.objects.get(year=2025)
        rows = BudgetOptimizer().generate_recommendations(fy.pk)
        assert len(rows) == 10 and sum(r["recommended_allocation"] for r in rows) == sum(r["current_allocation"] for r in rows)
        envr = next(r for r in rows if r["department_name"].startswith("Environment"))
        assert envr["confidence"] == "medium" and envr["flags"]
