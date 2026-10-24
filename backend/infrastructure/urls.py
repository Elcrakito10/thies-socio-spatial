from rest_framework.routers import DefaultRouter
from django.urls import path,include
from .views import InfrastructureViewSet
r=DefaultRouter(); r.register('infrastructures',InfrastructureViewSet,basename='infrastructure'); urlpatterns=[path('',include(r.urls))]
