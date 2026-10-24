from django.contrib.gis.db import models
from territory.models import Quartier


class Infrastructure(models.Model):

    TYPES = [
        ("sante", "Centre de santé"),
        ("lycee", "Lycée"),
        ("marche", "Marché"),
        ("parking", "Parking"),
        ("hotel", "Hôtel"),
        ("loisir", "Loisir"),
        ("autre", "Autre"),
    ]

    nom = models.CharField(
        max_length=200,
        blank=True,
        null=True
    )

    type = models.CharField(
        max_length=30,
        choices=TYPES
    )

    commune = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    quartier = models.CharField(
        max_length=150,
        blank=True,
        null=True
    )

    quartier_relation = models.ForeignKey(
        Quartier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="infrastructures"
    )

    source = models.CharField(
        max_length=200,
        blank=True,
        null=True
    )

    geom = models.PointField(
        srid=4326
    )

    class Meta:
        db_table = "infrastructure_points"
        indexes = [
            models.Index(fields=["type"]),
            models.Index(fields=["commune"]),
        ]

    def __str__(self):
        return f"{self.nom or 'Infrastructure'} — {self.type}"