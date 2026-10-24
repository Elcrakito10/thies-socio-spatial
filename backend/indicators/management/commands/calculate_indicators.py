from django.core.management.base import BaseCommand
from territory.models import Quartier
from indicators.models import QuartierIndicator


class Command(BaseCommand):
    help = "Calcule les indicateurs socio-spatiaux des quartiers."

    def handle(self, *args, **options):

        QuartierIndicator.objects.all().delete()

        total = 0

        for q in Quartier.objects.all():

            if not q.geom:
                continue

            # Surface réelle en km²
            geom = q.geom.transform(32628, clone=True)
            surface_km2 = geom.area / 1_000_000

            if surface_km2 <= 0:
                continue

            population = q.population or 0
            menages = q.menages or 0

            densite = population / surface_km2

            taille_menage = (
                population / menages
                if menages > 0 else 0
            )

            part_hommes = (
                q.hommes / population * 100
                if population > 0 else 0
            )

            part_femmes = (
                q.femmes / population * 100
                if population > 0 else 0
            )

            QuartierIndicator.objects.create(
                quartier=q,
                densite_population=round(densite, 2),
                taille_menage_moyenne=round(taille_menage, 2),
                part_hommes=round(part_hommes, 2),
                part_femmes=round(part_femmes, 2),
            )

            total += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Indicateurs calculés pour {total} quartiers."
            )
        )