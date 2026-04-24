import { TournamentEditionDetail, TournamentEditionList } from '../types';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Tournaments: undefined;
  Watchlist: undefined;
  Results: undefined;
  Alerts: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  TournamentDetail: { id: number; edition?: TournamentEditionList | TournamentEditionDetail };
  Onboarding: undefined;
  Coach: undefined;
  AdminPanel: undefined;
  MyRegistrations: undefined;
};
