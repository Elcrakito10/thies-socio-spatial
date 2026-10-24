from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from .models import HouseholdSurvey


@admin.register(HouseholdSurvey)
class SurveyAdmin(GISModelAdmin):
    list_display = (
        "id",
        "commune",
        "quartier",
        "age",
        "sexe",
        "instruction",
    )

    list_filter = (
        "commune",
        "sexe",
        "instruction",
    )

    search_fields = (
        "commune",
        "quartier",
    )

    ordering = ("id",)