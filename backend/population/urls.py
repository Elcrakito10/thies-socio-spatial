from rest_framework.routers import DefaultRouter
from django.urls import path,include
from .views import CensusViewSet
r=DefaultRouter(); r.register('census',CensusViewSet,basename='census'); urlpatterns=[path('',include(r.urls))]
