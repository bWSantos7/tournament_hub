from django.urls import path
from .views import RegistrationViewSet

reg = RegistrationViewSet.as_view

urlpatterns = [
    # Player
    path('', reg({'post': 'create'}), name='registration-create'),
    path('my/', reg({'get': 'my_registrations'}), name='registration-my'),
    path('<int:pk>/withdraw/', reg({'delete': 'withdraw'}), name='registration-withdraw'),

    # Admin
    path('edition/<int:edition_id>/', reg({'get': 'edition_list'}), name='registration-edition-list'),
    path('<int:pk>/confirm-payment/', reg({'post': 'confirm_payment'}), name='registration-confirm-payment'),
    path('<int:pk>/reset-payment/', reg({'post': 'reset_payment'}), name='registration-reset-payment'),
    path('<int:pk>/update-ranking/', reg({'patch': 'update_ranking'}), name='registration-update-ranking'),
    path('bulk-payment/', reg({'post': 'bulk_payment'}), name='registration-bulk-payment'),
]
