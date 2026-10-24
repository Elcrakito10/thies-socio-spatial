from django.contrib import admin
from django.urls import path, include
urlpatterns = [path('admin/', admin.site.urls), path('api/', include('territory.urls')), path('api/', include('population.urls')), path('api/', include('surveys.urls')), path('api/', include('infrastructure.urls')), path('api/', include('indicators.urls'))]
