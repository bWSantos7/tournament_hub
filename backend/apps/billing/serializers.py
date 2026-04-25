from decimal import Decimal
from rest_framework import serializers
from .models import Feature, Payment, Plan, PlanFeature, Subscription, WebhookEvent


class FeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feature
        fields = ('id', 'name', 'code', 'description')


class PlanFeatureSerializer(serializers.ModelSerializer):
    code  = serializers.CharField(source='feature.code', read_only=True)
    name  = serializers.CharField(source='feature.name', read_only=True)

    class Meta:
        model = PlanFeature
        fields = ('code', 'name', 'limit')


class PlanSerializer(serializers.ModelSerializer):
    features = PlanFeatureSerializer(source='plan_features', many=True, read_only=True)

    class Meta:
        model = Plan
        fields = (
            'id', 'name', 'slug', 'price_monthly', 'price_yearly',
            'description', 'highlight_label', 'display_order', 'is_active',
            'features',
        )


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_name    = serializers.CharField(source='plan.name', read_only=True)
    plan_slug    = serializers.CharField(source='plan.slug', read_only=True)
    price_monthly = serializers.DecimalField(source='plan.price_monthly', max_digits=8, decimal_places=2, read_only=True)
    price_yearly  = serializers.DecimalField(source='plan.price_yearly',  max_digits=8, decimal_places=2, read_only=True)

    class Meta:
        model = Subscription
        fields = (
            'id', 'plan', 'plan_name', 'plan_slug',
            'billing_period', 'status', 'is_active',
            'start_date', 'next_due_date',
            'cancel_at_period_end', 'canceled_at',
            'asaas_subscription_id',
            'price_monthly', 'price_yearly',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'status', 'start_date', 'next_due_date',
            'asaas_subscription_id', 'canceled_at',
            'created_at', 'updated_at',
        )


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            'id', 'amount', 'payment_method', 'status',
            'transaction_id', 'due_date', 'paid_at',
            'description', 'pix_code', 'boleto_url', 'created_at',
        )
        read_only_fields = fields


class CheckoutSerializer(serializers.Serializer):
    plan_slug      = serializers.ChoiceField(choices=['free', 'pro', 'elite'])
    billing_period = serializers.ChoiceField(choices=['monthly', 'yearly'], default='monthly')
    payment_method = serializers.ChoiceField(
        choices=['credit_card', 'pix', 'boleto', 'debit_card'], default='pix'
    )
    card_token        = serializers.CharField(required=False, allow_blank=True, default='')
    card_holder_name  = serializers.CharField(required=False, allow_blank=True, default='')
    card_number       = serializers.CharField(required=False, allow_blank=True, default='')
    card_expiry_month = serializers.CharField(required=False, allow_blank=True, default='')
    card_expiry_year  = serializers.CharField(required=False, allow_blank=True, default='')
    card_ccv          = serializers.CharField(required=False, allow_blank=True, default='')
    card_cpf          = serializers.CharField(required=False, allow_blank=True, default='')
    card_postal_code  = serializers.CharField(required=False, allow_blank=True, default='')


class CancelSubscriptionSerializer(serializers.Serializer):
    immediate = serializers.BooleanField(default=False, help_text='True = cancela agora; False = cancela no fim do período')
