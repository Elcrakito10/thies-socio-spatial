from rest_framework import serializers
from .models import CensusRecord
class CensusSerializer(serializers.ModelSerializer):
    class Meta: model=CensusRecord; fields='__all__'
