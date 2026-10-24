from rest_framework.viewsets import ReadOnlyModelViewSet
from .models import CensusRecord
from .serializers import CensusSerializer
class CensusViewSet(ReadOnlyModelViewSet):
    queryset=CensusRecord.objects.select_related('territory'); serializer_class=CensusSerializer
