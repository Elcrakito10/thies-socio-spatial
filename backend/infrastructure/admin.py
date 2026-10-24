from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from .models import Infrastructure


@admin.register(Infrastructure)
class InfrastructureAdmin(GISModelAdmin):
    list_display = (
        "nom",
        "type",
        "commune",
        "quartier",
        "source",
    )

    list_filter = (
        "type",
        "commune",
        "source",
    )

    search_fields = (
        "nom",
        "type",
        "commune",
        "quartier",
    )

    ordering = (
        "type",
        "nom",
    )