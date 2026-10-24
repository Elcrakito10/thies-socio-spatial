import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import GEOSGeometry
from territory.models import Territory

class Command(BaseCommand):
    help='Importe Region/Departement/Commune GeoJSON dans territory.Territory.'
    def add_arguments(self,p):
        p.add_argument('--data-dir',default='/data/source')
    def handle(self,*args,**opts):
        root=Path(opts['data_dir'])
        configs=[('Region.geojson','region','NOMREG'),('Departement.geojson','departement','N3NOM'),('Commune.geojson','commune','Nomcollect')]
        total=0
        for filename,level,name_field in configs:
            path=root/filename
            if not path.exists(): self.stdout.write(self.style.WARNING(f'Absent: {path}')); continue
            obj=json.loads(path.read_text(encoding='utf-8'))
            src_srid=4326
            crs=obj.get('crs',{}).get('properties',{}).get('name','')
            if '32628' in crs: src_srid=32628
            for feat in obj.get('features',[]):
                props=feat.get('properties') or {}; name=props.get(name_field)
                if not name: continue
                geom=GEOSGeometry(json.dumps(feat['geometry']))
                if src_srid != 4326: geom.srid=src_srid; geom.transform(4326)
                parent=props.get('Departemen') or props.get('DEPT') or props.get('Region') or ''
                Territory.objects.update_or_create(name=str(name).strip(),level=level,defaults={'parent_name':str(parent).strip(),'geom':geom})
                total+=1
        self.stdout.write(self.style.SUCCESS(f'{total} territoires importés/mis à jour.'))
