import os
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-only-change-me')
DEBUG = os.getenv('DJANGO_DEBUG', '0') == '1'
ALLOWED_HOSTS = ['*']
INSTALLED_APPS = [
    'django.contrib.admin','django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','django.contrib.gis',
    'corsheaders','rest_framework','territory','population','surveys','infrastructure','indicators','accessibility','segregation','spatial_analysis'
]
MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware','django.middleware.security.SecurityMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[],'APP_DIRS':True,'OPTIONS':{'context_processors':['django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
DATABASES = {'default': {'ENGINE':'django.contrib.gis.db.backends.postgis','NAME':os.getenv('POSTGRES_DB','thies_socio_spatial'),'USER':os.getenv('POSTGRES_USER','thies'),'PASSWORD':os.getenv('POSTGRES_PASSWORD','thies_dev_password'),'HOST':os.getenv('POSTGRES_HOST','localhost'),'PORT':os.getenv('POSTGRES_PORT','5432')}}
LANGUAGE_CODE='fr-fr'; TIME_ZONE='Africa/Dakar'; USE_I18N=True; USE_TZ=True
STATIC_URL='static/'
DEFAULT_AUTO_FIELD='django.db.models.BigAutoField'
CORS_ALLOW_ALL_ORIGINS = True
REST_FRAMEWORK = {'DEFAULT_PERMISSION_CLASSES':['rest_framework.permissions.AllowAny'],'DEFAULT_RENDERER_CLASSES':['rest_framework.renderers.JSONRenderer']}
