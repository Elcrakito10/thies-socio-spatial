from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from .models import Quartier


@admin.register(Quartier)
class QuartierAdmin(GISModelAdmin):
    list_display = (
        "nom",
        "commune",
        "population",
        "menages",
        "hommes",
        "femmes",
        "annee",
    )

    list_filter = (
        "commune",
        "annee",
    )

    search_fields = (
        "nom",
        "commune",
    )

    ordering = (
        "commune",
        "nom",
    )