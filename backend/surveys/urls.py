from rest_framework.routers import DefaultRouter
from django.urls import path,include
from .views import SurveyViewSet
r=DefaultRouter(); r.register('surveys',SurveyViewSet,basename='survey'); urlpatterns=[path('',include(r.urls))]
