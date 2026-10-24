from rest_framework import serializers

from .models import QuartierIndicator


class QuartierIndicatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuartierIndicator
        fields = "__all__"