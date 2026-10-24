from django.contrib import admin

from .models import QuartierIndicator


@admin.register(QuartierIndicator)
class QuartierIndicatorAdmin(admin.ModelAdmin):
    list_display = (
        "quartier",
        "densite_population",
        "taille_menage_moyenne",
        "indice_habitat",
        "indice_equipement",
        "indice_accessibilite",
        "indice_socio_economique",
        "indice_socio_spatial",
        "moran_i",
    )

    search_fields = (
        "quartier__nom",
        "quartier__commune",
    )

    ordering = (
        "quartier__commune",
        "quartier__nom",
    )