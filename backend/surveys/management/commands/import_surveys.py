import re
import pandas as pd
from shapely import wkt
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from surveys.models import HouseholdSurvey

class Command(BaseCommand):
    help='Importe toutes les feuilles du classeur d’enquêtes et dédoublonne les observations par géométrie.'
    def add_arguments(self,p): p.add_argument('--file',required=True)
    def handle(self,*args,**opts):
        xls=pd.ExcelFile(opts['file']); seen=set(); objs=[]
        for sheet in xls.sheet_names:
            df=pd.read_excel(opts['file'],sheet_name=sheet)
            for _,r in df.iterrows():
                w=str(r.get('wkt_geom','')).strip()
                fid='' if pd.isna(r.get('fid')) else str(r.get('fid')).strip()
                key=(fid,w)
                if not w or key in seen: continue
                seen.add(key)
                try:
                    g=wkt.loads(w); pt=list(g.geoms)[0] if g.geom_type=='MultiPoint' else g
                    geom=Point(float(pt.x),float(pt.y),srid=32628)
                except Exception: continue
                def text(k):
                    v=r.get(k,''); return '' if pd.isna(v) else str(v).strip()
                def integer(k):
                    v=r.get(k); return None if pd.isna(v) else int(float(v))
                def decimal(k):
                    v=r.get(k); return None if pd.isna(v) else float(v)
                q='; '.join([text('quartier_est'),text('quartier_nord'),text('quartier_ouest')]).strip('; ')
                objs.append(HouseholdSurvey(source_sheet=sheet,fid=fid,commune=text('commune'),quartier=q,taille_menage=integer('taille_menage'),age=integer('age'),sexe=text('sexe'),instruction=text('instruction'),profession=text('profession'),statut_occupation=text('statut_occupation'),anciennete_residence=integer('anciennete_residence'),materiau_mur=text('materiau_mur'),materiau_toit=text('materiau_toit'),materiau_sol=text('materiau_sol'),nb_pieces=integer('nb_pieces'),gestion_dechets=text('gestion_dechets'),transport=text('moyen_transport_principal'),frequence=text('Frequence'),cout_transport=decimal('Cou_du_transport'),temps_transport=decimal('Temps'),geom=geom))
        HouseholdSurvey.objects.all().delete(); HouseholdSurvey.objects.bulk_create(objs,batch_size=500)
        self.stdout.write(self.style.SUCCESS(f'{len(objs)} enquêtes uniques importées depuis {len(xls.sheet_names)} feuilles.'))
