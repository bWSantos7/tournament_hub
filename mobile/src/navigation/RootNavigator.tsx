import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { AuthStackParamList, MainStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { MainTabs } from './Tabs';
import { TournamentDetailScreen } from '../screens/app/TournamentDetailScreen';
import { OnboardingScreen } from '../screens/app/OnboardingScreen';
import { CoachScreen } from '../screens/app/CoachScreen';
import { AdminPanelScreen } from '../screens/app/AdminPanelScreen';
import { MyRegistrationsScreen } from '../screens/app/MyRegistrationsScreen';
import { RegistrationListScreen } from '../screens/app/RegistrationListScreen';
import { PlansScreen } from '../screens/app/PlansScreen';
import { CheckoutScreen } from '../screens/app/CheckoutScreen';
import { SubscriptionScreen } from '../screens/app/SubscriptionScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

export function RootNavigator() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
        <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </AuthStack.Navigator>
    );
  }

  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Tabs" component={MainTabs} />
      <MainStack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
      <MainStack.Screen name="Onboarding" component={OnboardingScreen} />
      <MainStack.Screen name="Coach" component={CoachScreen} />
      <MainStack.Screen name="AdminPanel" component={AdminPanelScreen} />
      <MainStack.Screen name="MyRegistrations" component={MyRegistrationsScreen} />
      <MainStack.Screen name="RegistrationList" component={RegistrationListScreen} />
      <MainStack.Screen name="Plans" component={PlansScreen} options={{ title: 'Planos' }} />
      <MainStack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Finalizar assinatura' }} />
      <MainStack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Minha assinatura' }} />
    </MainStack.Navigator>
  );
}
