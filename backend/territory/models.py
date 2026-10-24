from django.contrib.gis.db import models


class Quartier(models.Model):
    nom = models.CharField(max_length=150)
    commune = models.CharField(max_length=100, blank=True, null=True)

    population = models.PositiveIntegerField(default=0)
    menages = models.PositiveIntegerField(default=0)
    hommes = models.PositiveIntegerField(default=0)
    femmes = models.PositiveIntegerField(default=0)

    annee = models.PositiveIntegerField(default=2023)

    geom = models.MultiPolygonField(
        srid=4326,
        blank=True,
        null=True
    )

    class Meta:
        db_table = "territory_quartiers"
        ordering = ["commune", "nom"]
        indexes = [
            models.Index(fields=["commune"]),
            models.Index(fields=["nom"]),
        ]

    def __str__(self):
        return f"{self.nom} — {self.commune or 'Commune inconnue'}"