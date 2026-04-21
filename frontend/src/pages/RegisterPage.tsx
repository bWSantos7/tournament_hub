import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { register } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import { extractApiError } from '../services/api';

export const RegisterPage: React.FC = () => {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    password_confirm: '',
    role: 'player',
    accept_terms: false,
    marketing_consent: false,
  });
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.password_confirm) {
      toast.error('As senhas não conferem');
      return;
    }
    if (form.password.length < 8) {
      toast.error('A senha precisa ter ao menos 8 caracteres');
      return;
    }
    setSubmitting(true);
    try {
      const data = await register(form);
      setUser(data.user);
      toast.success('Conta criada! Vamos montar seu perfil.');
      nav('/onboarding', { replace: true });
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-accent-neon flex items-center justify-center shadow-glow mb-3">
            <Trophy className="w-6 h-6 text-bg-base" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold">Criar conta</h1>
        </div>

        <form onSubmit={onSubmit} className="card space-y-3">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Nome</label>
            <input
              className="input-base"
              placeholder="Seu nome"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">E-mail</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input-base"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Perfil</label>
            <select
              className="input-base"
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
            >
              <option value="player">Jogador</option>
              <option value="coach">Treinador</option>
              <option value="parent">Pai/Responsável</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Senha</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input-base"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Confirme a senha</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input-base"
              value={form.password_confirm}
              onChange={(e) => update('password_confirm', e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              required
              className="mt-0.5 accent-accent-neon"
              checked={form.accept_terms}
              onChange={(e) => update('accept_terms', e.target.checked)}
            />
            <span>
              Li e aceito os termos de uso e a política de privacidade (LGPD).
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-accent-neon"
              checked={form.marketing_consent}
              onChange={(e) => update('marketing_consent', e.target.checked)}
            />
            <span>Quero receber e-mails com novidades e dicas.</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar conta
          </button>
        </form>

        <div className="text-center mt-4 text-sm text-text-secondary">
          Já tem conta?{' '}
          <Link to="/login" className="text-accent-neon font-medium hover:underline">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
};
