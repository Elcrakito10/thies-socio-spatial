from rest_framework import viewsets

from .models import QuartierIndicator
from .serializers import QuartierIndicatorSerializer


class IndicatorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = QuartierIndicator.objects.all()
    serializer_class = QuartierIndicatorSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        commune = self.request.query_params.get("commune")

        if commune:
            qs = qs.filter(quartier__commune__icontains=commune)

        return qs