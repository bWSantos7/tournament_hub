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
    </MainStack.Navigator>
  );
}
