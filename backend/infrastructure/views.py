from rest_framework.viewsets import ReadOnlyModelViewSet
from .models import Infrastructure
from .serializers import InfrastructureSerializer
class InfrastructureViewSet(ReadOnlyModelViewSet):
    queryset=Infrastructure.objects.all(); serializer_class=InfrastructureSerializer
    def get_queryset(self):
        qs=super().get_queryset(); c=self.request.query_params.get('category'); commune=self.request.query_params.get('commune')
        if c: qs=qs.filter(category=c)
        if commune: qs=qs.filter(commune__icontains=commune)
        return qs
