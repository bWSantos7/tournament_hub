import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, Mail, Phone, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { register } from '../services/auth';
import { sendEmailOtp, verifyEmailOtp, sendPhoneOtp, verifyPhoneOtp } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import { extractApiError } from '../services/api';

type Step = 'form' | 'email_otp' | 'phone_otp' | 'done';

export const RegisterPage: React.FC = () => {
  const nav = useNavigate();
  const { setUser } = useAuth();

  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirm: '',
    role: 'player',
    accept_terms: false,
    marketing_consent: false,
  });
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // ─── Step 1: Register ────────────────────────────────────────────────────
  async function onRegister(e: React.FormEvent) {
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
      // Email OTP is sent automatically by the backend on register
      toast.success('Conta criada! Verifique seu e-mail.');
      setStep('email_otp');
      setTimeout(() => emailInputRef.current?.focus(), 100);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Step 2: Verify email OTP ────────────────────────────────────────────
  async function onVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await verifyEmailOtp(emailCode.trim());
      // Now send phone OTP
      if (form.phone) {
        await sendPhoneOtp(form.phone);
        toast.success('E-mail verificado! Código enviado ao celular.');
        setStep('phone_otp');
        setTimeout(() => phoneInputRef.current?.focus(), 100);
      } else {
        toast.success('E-mail verificado!');
        nav('/onboarding', { replace: true });
      }
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Step 3: Verify phone OTP ────────────────────────────────────────────
  async function onVerifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await verifyPhoneOtp(phoneCode.trim());
      toast.success('Telefone verificado! Bem-vindo!');
      nav('/onboarding', { replace: true });
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function resendEmailOtp() {
    setResending(true);
    try {
      await sendEmailOtp();
      toast.success('Novo código enviado ao e-mail.');
    } catch {
      toast.error('Não foi possível reenviar. Tente em instantes.');
    } finally {
      setResending(false);
    }
  }

  async function resendPhoneOtp() {
    setResending(true);
    try {
      await sendPhoneOtp(form.phone);
      toast.success('Novo código enviado ao celular.');
    } catch {
      toast.error('Não foi possível reenviar. Tente em instantes.');
    } finally {
      setResending(false);
    }
  }

  // ─── Progress indicator ──────────────────────────────────────────────────
  const steps = [
    { key: 'form', label: 'Dados' },
    { key: 'email_otp', label: 'E-mail' },
    { key: 'phone_otp', label: 'Celular' },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-accent-neon flex items-center justify-center shadow-glow mb-3">
            <Trophy className="w-6 h-6 text-bg-base" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold">Criar conta</h1>
        </div>

        {/* Progress dots */}
        {step !== 'done' && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < stepIdx
                        ? 'bg-accent-neon text-bg-base'
                        : i === stepIdx
                        ? 'bg-accent-neon text-bg-base ring-2 ring-accent-neon ring-offset-2 ring-offset-bg-base'
                        : 'bg-bg-card text-text-muted border border-border'
                    }`}
                  >
                    {i < stepIdx ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="text-[10px] text-text-muted">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`h-px w-8 mb-4 transition-colors ${
                      i < stepIdx ? 'bg-accent-neon' : 'bg-border'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ─── Step 1: Form ─────────────────────────────────────────────── */}
        {step === 'form' && (
          <form onSubmit={onRegister} className="card space-y-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Nome</label>
              <input
                className="input-base"
                placeholder="Seu nome completo"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">E-mail *</label>
              <input
                type="email"
                required
                autoComplete="email"
                className="input-base"
                placeholder="voce@exemplo.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">
                Celular{' '}
                <span className="text-text-muted">(com DDD, ex: 11999999999)</span>
              </label>
              <input
                type="tel"
                autoComplete="tel"
                className="input-base"
                placeholder="11999999999"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value.replace(/\D/g, ''))}
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
              <label className="text-xs text-text-secondary mb-1 block">Senha *</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input-base"
                placeholder="Mínimo 8 caracteres"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Confirme a senha *</label>
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
              <span>Li e aceito os termos de uso e a política de privacidade (LGPD).</span>
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
        )}

        {/* ─── Step 2: Email OTP ────────────────────────────────────────── */}
        {step === 'email_otp' && (
          <form onSubmit={onVerifyEmail} className="card space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <Mail className="w-10 h-10 text-accent-neon" />
              <p className="text-sm text-text-secondary">
                Enviamos um código de 6 dígitos para{' '}
                <span className="text-text-primary font-medium">{form.email}</span>
              </p>
            </div>
            <div>
              <label className="text-xs text-text-secondary font-medium mb-1 block">
                Código de verificação
              </label>
              <input
                ref={emailInputRef}
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                className="input-base text-center tracking-[0.5em] text-lg font-bold"
                placeholder="000000"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || emailCode.length !== 6}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Verificar e-mail
            </button>
            <button
              type="button"
              disabled={resending}
              onClick={resendEmailOtp}
              className="w-full text-xs text-text-muted hover:text-accent-neon transition-colors flex items-center justify-center gap-1"
            >
              {resending && <Loader2 className="w-3 h-3 animate-spin" />}
              Reenviar código
            </button>
          </form>
        )}

        {/* ─── Step 3: Phone OTP ────────────────────────────────────────── */}
        {step === 'phone_otp' && (
          <form onSubmit={onVerifyPhone} className="card space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <Phone className="w-10 h-10 text-accent-neon" />
              <p className="text-sm text-text-secondary">
                Enviamos um código por SMS para o celular informado.
              </p>
            </div>
            <div>
              <label className="text-xs text-text-secondary font-medium mb-1 block">
                Código de verificação
              </label>
              <input
                ref={phoneInputRef}
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                className="input-base text-center tracking-[0.5em] text-lg font-bold"
                placeholder="000000"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || phoneCode.length !== 6}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Verificar celular
            </button>
            <button
              type="button"
              disabled={resending}
              onClick={resendPhoneOtp}
              className="w-full text-xs text-text-muted hover:text-accent-neon transition-colors flex items-center justify-center gap-1"
            >
              {resending && <Loader2 className="w-3 h-3 animate-spin" />}
              Reenviar código
            </button>
            <button
              type="button"
              onClick={() => nav('/onboarding', { replace: true })}
              className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Pular por agora
            </button>
          </form>
        )}

        {step === 'form' && (
          <div className="text-center mt-4 text-sm text-text-secondary">
            Já tem conta?{' '}
            <Link to="/login" className="text-accent-neon font-medium hover:underline">
              Entrar
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
