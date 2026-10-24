from django.db import models
from territory.models import Quartier


class QuartierIndicator(models.Model):

    quartier = models.OneToOneField(
        Quartier,
        on_delete=models.CASCADE,
        related_name="indicators"
    )

    densite_population = models.FloatField(
        null=True,
        blank=True
    )

    taille_menage_moyenne = models.FloatField(
        null=True,
        blank=True
    )

    part_hommes = models.FloatField(
        null=True,
        blank=True
    )

    part_femmes = models.FloatField(
        null=True,
        blank=True
    )

    indice_habitat = models.FloatField(
        null=True,
        blank=True
    )

    indice_equipement = models.FloatField(
        null=True,
        blank=True
    )

    indice_accessibilite = models.FloatField(
        null=True,
        blank=True
    )

    indice_socio_economique = models.FloatField(
        null=True,
        blank=True
    )

    indice_socio_spatial = models.FloatField(
        null=True,
        blank=True
    )

    moran_i = models.FloatField(
        null=True,
        blank=True
    )

    class Meta:
        db_table = "analysis_quartier_indicators"

    def __str__(self):
        return f"Indicateurs — {self.quartier.nom}"