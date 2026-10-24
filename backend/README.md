# THIES-SOCIO-SPATIAL — Backend

## Lancer

```bash
docker compose up --build
```

Dans un second terminal :

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

## Import initial

Copier les 3 fichiers de limites et les 2 XLSX dans `data/source/`, puis :

```bash
docker compose exec backend python manage.py import_boundaries --data-dir /data/source
docker compose exec backend python manage.py import_census --file "/data/source/data-recensement thies (2).xlsx"
docker compose exec backend python manage.py import_surveys --file "/data/source/resultats (4).xlsx"
```

## API

- `/api/health/`
- `/api/territories/`
- `/api/census/`
- `/api/surveys/`
- `/api/infrastructures/`
- `/api/indicators/`

Les coordonnées d'enquête sont conservées en EPSG:32628 car le WKT source est projeté. Les limites sont transformées vers EPSG:4326 pour le web.
