import ipaddress
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    RegisterSerializer,
    UserSerializer,
    UserUpdateSerializer,
    CustomTokenObtainPairSerializer,
    PasswordChangeSerializer,
)

logger = logging.getLogger('apps.accounts')

User = get_user_model()


class RegisterThrottle(AnonRateThrottle):
    rate = '10/hour'


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            ip = self._get_ip(request)
            email = request.data.get('email')
            if email:
                try:
                    user = User.objects.get(email=email)
                    user.last_login = timezone.now()
                    user.last_login_ip = ip
                    user.save(update_fields=['last_login', 'last_login_ip'])
                except User.DoesNotExist:
                    pass
        return response

    @staticmethod
    def _get_ip(request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if xff:
            candidate = xff.split(',')[0].strip()
            try:
                ipaddress.ip_address(candidate)
                return candidate
            except ValueError:
                pass
        return request.META.get('REMOTE_ADDR', '')


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ['PATCH', 'PUT']:
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        return Response(UserSerializer(self.get_object()).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = request.user
    if not user.check_password(serializer.validated_data['old_password']):
        return Response(
            {'old_password': 'Senha atual incorreta.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    user.set_password(serializer.validated_data['new_password'])
    user.save()
    return Response({'detail': 'Senha alterada com sucesso.'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({'detail': 'Logout realizado.'}, status=status.HTTP_205_RESET_CONTENT)
    except Exception:
        return Response({'detail': 'Logout realizado.'}, status=status.HTTP_205_RESET_CONTENT)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_account(request):
    """LGPD: permite exclusão de conta do próprio usuário."""
    user = request.user
    user.is_active = False
    user.email = f'deleted-{user.id}@example.invalid'
    user.full_name = ''
    user.save()
    return Response({'detail': 'Conta removida.'}, status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestThrottle(AnonRateThrottle):
    rate = '5/hour'


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([PasswordResetRequestThrottle])
def password_reset_request(request):
    """Envia email com link para redefinição de senha."""
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'detail': 'Email obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)

    # Always return 200 to avoid user enumeration
    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        return Response({'detail': 'Se o email existir, enviaremos as instruções.'})

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    reset_url = f'{frontend_url}/redefinir-senha/{uid}/{token}/'

    try:
        send_mail(
            subject='[Tournament Hub] Redefinição de senha',
            message=(
                f'Olá {user.full_name or user.email},\n\n'
                f'Clique no link abaixo para redefinir sua senha (válido por 24h):\n\n'
                f'{reset_url}\n\n'
                f'Se não foi você, ignore este email.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
    except Exception:
        logger.exception('Failed to send password reset email to %s', email)

    return Response({'detail': 'Se o email existir, enviaremos as instruções.'})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def password_reset_confirm(request):
    """Confirma redefinição de senha com uid + token."""
    uid = request.data.get('uid', '')
    token = request.data.get('token', '')
    new_password = request.data.get('new_password', '')
    confirm_password = request.data.get('confirm_password', '')

    if not all([uid, token, new_password, confirm_password]):
        return Response({'detail': 'Todos os campos são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

    if new_password != confirm_password:
        return Response({'detail': 'As senhas não coincidem.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_pk = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_pk, is_active=True)
    except (User.DoesNotExist, ValueError, TypeError):
        return Response({'detail': 'Link inválido ou expirado.'}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({'detail': 'Link inválido ou expirado.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    return Response({'detail': 'Senha redefinida com sucesso.'})
