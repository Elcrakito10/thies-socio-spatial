import json
from rest_framework import serializers
from .models import Quartier


class QuartierSerializer(serializers.ModelSerializer):

    geometry = serializers.SerializerMethodField()

    class Meta:
        model = Quartier
        fields = [
            "id",
            "nom",
            "commune",
            "population",
            "menages",
            "hommes",
            "femmes",
            "annee",
            "geometry",
        ]

    def get_geometry(self, obj):
        if not obj.geom:
            return None

        return json.loads(obj.geom.geojson)