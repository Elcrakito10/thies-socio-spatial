from django.db import models
from territory.models import Quartier


class CensusRecord(models.Model):
    quartier = models.ForeignKey(
        Quartier,
        on_delete=models.CASCADE,
        related_name="census_records"
    )

    annee = models.PositiveIntegerField()

    concessions = models.PositiveIntegerField(default=0)
    menages = models.PositiveIntegerField(default=0)
    hommes = models.PositiveIntegerField(default=0)
    femmes = models.PositiveIntegerField(default=0)
    population = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "population_census"
        ordering = ["-annee", "quartier"]

    def __str__(self):
        return f"{self.quartier.nom} — {self.annee}"