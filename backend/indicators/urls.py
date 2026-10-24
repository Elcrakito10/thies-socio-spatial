from rest_framework.routers import DefaultRouter
from django.urls import path,include
from .views import IndicatorViewSet
r=DefaultRouter(); r.register('indicators',IndicatorViewSet,basename='indicator'); urlpatterns=[path('',include(r.urls))]
