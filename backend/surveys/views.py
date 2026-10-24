from rest_framework.viewsets import ReadOnlyModelViewSet
from .models import HouseholdSurvey
from .serializers import HouseholdSurveySerializer
class SurveyViewSet(ReadOnlyModelViewSet):
    queryset=HouseholdSurvey.objects.all(); serializer_class=HouseholdSurveySerializer
