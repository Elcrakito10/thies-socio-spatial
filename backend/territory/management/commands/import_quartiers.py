import os

from django.core.management.base import BaseCommand, CommandError
from django.contrib.gis.gdal import DataSource
from django.contrib.gis.geos import GEOSGeometry

from territory.models import Quartier

class Command(BaseCommand):
    help = "Importe les limites des quartiers de Thiès dans PostGIS."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default="/data/source/quartier_TH.shp",
            help="Chemin vers le shapefile des quartiers",
        )

        parser.add_argument(
            "--clear",
            action="store_true",
            help="Supprime les quartiers existants avant import",
        )

    def handle(self, *args, **options):
        file_path = options["file"]

        if not os.path.exists(file_path):
            raise CommandError(
                f"Shapefile introuvable : {file_path}"
            )

        self.stdout.write(
            self.style.WARNING(
                f"Lecture du shapefile : {file_path}"
            )
        )

        ds = DataSource(file_path)

        if len(ds) == 0:
            raise CommandError("Aucune couche trouvée dans le shapefile.")

        layer = ds[0]

        self.stdout.write(
            f"Couche : {layer.name}"
        )

        self.stdout.write(
            f"Nombre d'entités : {len(layer)}"
        )

        self.stdout.write(
            f"Projection source : {layer.srs}"
        )

        if options["clear"]:
            count = Quartier.objects.count()

            Quartier.objects.all().delete()

            self.stdout.write(
                self.style.WARNING(
                    f"{count} quartier(s) existant(s) supprimé(s)."
                )
            )

        imported = 0
        skipped = 0

        for feature in layer:

            try:
                # Nom du quartier
                nom = str(feature["QRT_VLG_HA"]).strip()

                # Commune
                commune = str(feature["CAV"]).strip()

                if not nom:
                    self.stdout.write(
                        self.style.WARNING(
                            "Entité ignorée : nom de quartier vide."
                        )
                    )
                    skipped += 1
                    continue

                # Géométrie
                geom = GEOSGeometry(
                    feature.geom.wkt,
                    srid=layer.srs.srid
                )

                # Transformation vers EPSG:4326
                if geom.srid != 4326:
                    geom.transform(4326)

                # Conversion Polygon → MultiPolygon
                if geom.geom_type == "Polygon":
                    geom = GEOSGeometry(
                        f"MULTIPOLYGON ({geom.wkt[7:]})",
                        srid=4326
                    )

                if geom.geom_type != "MultiPolygon":
                    self.stdout.write(
                        self.style.WARNING(
                            f"Géométrie ignorée pour {nom} : "
                            f"{geom.geom_type}"
                        )
                    )
                    skipped += 1
                    continue

                # Création / mise à jour
                quartier, created = Quartier.objects.update_or_create(
                    nom=nom,
                    commune=commune,
                    defaults={
                        "geom": geom,
                    },
                )

                imported += 1

                action = "créé" if created else "mis à jour"

                self.stdout.write(
                    f"  ✓ {nom} — {commune} ({action})"
                )

            except Exception as e:
                skipped += 1

                self.stdout.write(
                    self.style.ERROR(
                        f"Erreur pour une entité : {e}"
                    )
                )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Import terminé : {imported} quartier(s) traité(s)."
            )
        )

        if skipped:
            self.stdout.write(
                self.style.WARNING(
                    f"{skipped} entité(s) ignorée(s)."
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Total actuellement dans PostGIS : "
                f"{Quartier.objects.count()} quartier(s)."
            )
        )