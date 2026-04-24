import { api } from './api';
import { TournamentRegistration } from '../types';

export async function myRegistrations(): Promise<TournamentRegistration[]> {
  const { data } = await api.get('/api/registrations/my/');
  return data;
}

export async function registerForEdition(payload: {
  edition: number;
  category?: number | null;
  ranking_position?: number | null;
}): Promise<TournamentRegistration> {
  const { data } = await api.post('/api/registrations/', payload);
  return data;
}

export async function withdrawRegistration(id: number): Promise<void> {
  await api.delete(`/api/registrations/${id}/withdraw/`);
}

export async function editionRegistrations(editionId: number, params?: {
  include_withdrawn?: boolean;
  category_id?: number;
}): Promise<{ summary: { total: number; paid: number; pending_payment: number }; registrations: any[] }> {
  const { data } = await api.get(`/api/registrations/edition/${editionId}/`, { params });
  return data;
}

export async function confirmPayment(id: number, notes?: string): Promise<any> {
  const { data } = await api.post(`/api/registrations/${id}/confirm-payment/`, { notes: notes ?? '' });
  return data;
}

export async function resetPayment(id: number): Promise<any> {
  const { data } = await api.post(`/api/registrations/${id}/reset-payment/`);
  return data;
}

export async function bulkPayment(payload: {
  registration_ids: number[];
  payment_status: string;
  notes?: string;
}): Promise<{ detail: string }> {
  const { data } = await api.post('/api/registrations/bulk-payment/', payload);
  return data;
}

export async function updateRanking(id: number, ranking_position: number | null): Promise<void> {
  await api.patch(`/api/registrations/${id}/update-ranking/`, { ranking_position });
}
