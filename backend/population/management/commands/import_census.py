import pandas as pd
import csv
import io

from django.core.management.base import BaseCommand
from population.models import CensusRecord
from territory.models import Quartier


class Command(BaseCommand):
    help = "Importe les données du recensement dans les quartiers."

    def add_arguments(self, parser):
        parser.add_argument("--file", required=True)
        parser.add_argument("--clear", action="store_true")

    def handle(self, *args, **opts):

        df = pd.read_excel(opts["file"], sheet_name=0)

        if opts["clear"]:
            CensusRecord.objects.all().delete()

        imported = 0
        unmatched = 0

        def num(value):
            try:
                return int(float(value))
            except:
                return 0

        def normalize(text):
            return (
                str(text)
                .upper()
                .strip()
                .replace("É", "E")
                .replace("È", "E")
                .replace("Ê", "E")
                .replace("À", "A")
                .replace("'", " ")
                .replace("-", " ")
            )

        for raw in df.iloc[:, 0].dropna().astype(str):

            try:
                vals = next(csv.reader(io.StringIO(raw)))
                vals += [""] * (11 - len(vals))

                (
                    region,
                    department,
                    arrondissement,
                    commune,
                    locality,
                    concessions,
                    households,
                    men,
                    women,
                    population,
                    year,
                ) = vals[:11]

                locality_norm = normalize(locality)
                commune_norm = normalize(commune)

                quartier = None

                # Correspondance exacte
                for q in Quartier.objects.all():
                    if normalize(q.nom) == locality_norm:
                        quartier = q
                        break

                # Correspondance avec variantes numériques
                if not quartier:
                    variantes = {
                        "1": "I",
                        "2": "II",
                        "3": "III",
                        "4": "IV",
                    }

                    recherche = locality_norm

                    for chiffre, romain in variantes.items():
                        recherche = recherche.replace(
                            f" {chiffre}",
                            f" {romain}"
                        )

                    for q in Quartier.objects.all():
                        if normalize(q.nom) == recherche:
                            quartier = q
                            break

                if not quartier:
                    unmatched += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"⚠ Introuvable : {locality} — {commune}"
                        )
                    )
                    continue

                annee = num(year) or 2023

                CensusRecord.objects.update_or_create(
                    quartier=quartier,
                    annee=annee,
                    defaults={
                        "concessions": num(concessions),
                        "menages": num(households),
                        "hommes": num(men),
                        "femmes": num(women),
                        "population": num(population),
                    },
                )

                # Mise à jour également de la table des quartiers
                quartier.population = num(population)
                quartier.menages = num(households)
                quartier.hommes = num(men)
                quartier.femmes = num(women)
                quartier.annee = annee
                quartier.save()

                imported += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Erreur : {e}")
                )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"✓ {imported} ligne(s) importée(s)"
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"⚠ {unmatched} localité(s) non associée(s)"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"✓ {Quartier.objects.count()} quartiers dans PostGIS"
            )
        )