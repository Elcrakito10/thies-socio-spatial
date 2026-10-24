from rest_framework import serializers
from .models import HouseholdSurvey
class HouseholdSurveySerializer(serializers.ModelSerializer):
    class Meta: model=HouseholdSurvey; fields='__all__'
