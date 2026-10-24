from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Quartier
from .serializers import QuartierSerializer


class QuartierViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Quartier.objects.all()
    serializer_class = QuartierSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        commune = self.request.query_params.get("commune")
        nom = self.request.query_params.get("nom")

        if commune:
            qs = qs.filter(commune__icontains=commune)

        if nom:
            qs = qs.filter(nom__icontains=nom)

        return qs


@api_view(["GET"])
def health(request):
    return Response({
        "status": "ok",
        "project": "THIES-SOCIO-SPATIAL"
    })