from django.contrib.gis.db import models
from territory.models import Quartier


class HouseholdSurvey(models.Model):
    quartier = models.ForeignKey(
        Quartier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="surveys"
    )

    commune = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    taille_menage = models.PositiveIntegerField(
        blank=True,
        null=True
    )

    age = models.PositiveIntegerField(
        blank=True,
        null=True
    )

    sexe = models.CharField(
        max_length=30,
        blank=True,
        null=True
    )

    instruction = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    profession = models.CharField(
        max_length=150,
        blank=True,
        null=True
    )

    statut_occupation = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    anciennete_residence = models.PositiveIntegerField(
        blank=True,
        null=True
    )

    materiau_mur = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    materiau_toit = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    materiau_sol = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    nb_pieces = models.PositiveIntegerField(
        blank=True,
        null=True
    )

    gestion_dechets = models.CharField(
        max_length=150,
        blank=True,
        null=True
    )

    moyen_transport = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    frequence = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    cout_transport = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True
    )

    temps_transport = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True
    )

    geom = models.PointField(
        srid=4326,
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "surveys_household_surveys"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Enquête #{self.pk}"