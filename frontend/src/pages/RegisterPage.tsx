import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, Mail, Phone, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { register, sendEmailOtp, verifyEmailOtp, sendPhoneOtp, verifyPhoneOtp } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import { extractApiError } from '../services/api';
import { User } from '../types';

type Step = 'form' | 'email_otp' | 'phone_otp';

export const RegisterPage: React.FC = () => {
  const nav = useNavigate();
  const { setUser } = useAuth();

  const [step, setStep] = useState<Step>('form');
  const [registeredUser, setRegisteredUser] = useState<User | null>(null);
  const [duplicateEmail, setDuplicateEmail] = useState(false);
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
    if (k === 'email') setDuplicateEmail(false);
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
    const rawPhone = form.phone.replace(/\D/g, '');
    if (rawPhone.length < 10) {
      toast.error('Informe um número de celular válido com DDD');
      return;
    }
    setSubmitting(true);
    try {
      // IMPORTANT: we do NOT call setUser() here.
      // Calling setUser() would make isAuthenticated=true, causing PublicOnlyRoute
      // to redirect away from /register before the OTP steps can be shown.
      // Tokens are saved to localStorage by register() so OTP endpoints work.
      // setUser() is only called after all OTP steps are complete.
      const data = await register({ ...form, phone: rawPhone });
      setRegisteredUser(data.user);
      // Email OTP is sent automatically by the backend on register
      toast.success('Conta criada! Verifique seu e-mail.');
      setStep('email_otp');
      setTimeout(() => emailInputRef.current?.focus(), 100);
    } catch (err) {
      const msg = extractApiError(err);
      const isEmailTaken =
        msg.toLowerCase().includes('email') && msg.toLowerCase().includes('existe');
      if (isEmailTaken) {
        setDuplicateEmail(true);
      } else {
        toast.error(msg);
      }
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
      const rawPhone = form.phone.replace(/\D/g, '');
      if (rawPhone) {
        await sendPhoneOtp(rawPhone);
        toast.success('E-mail verificado! Código enviado ao celular.');
        setStep('phone_otp');
        setTimeout(() => phoneInputRef.current?.focus(), 100);
      } else {
        finishRegistration();
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
      toast.success('Celular verificado! Bem-vindo!');
      finishRegistration();
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function finishRegistration() {
    // Only now we set the user in context, completing authentication
    if (registeredUser) setUser(registeredUser);
    nav('/onboarding', { replace: true });
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
      await sendPhoneOtp(form.phone.replace(/\D/g, ''));
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
                className={`input-base ${duplicateEmail ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="voce@exemplo.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
              {duplicateEmail && (
                <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 space-y-1">
                  <p className="font-medium">Este e-mail já possui cadastro.</p>
                  <p>
                    <Link to="/login" className="underline text-accent-neon">
                      Entrar na conta
                    </Link>{' '}
                    ou{' '}
                    <Link to="/recuperar-senha" className="underline text-accent-neon">
                      recuperar senha
                    </Link>
                    .
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-text-secondary mb-1 block">
                Celular * <span className="text-text-muted">(com DDD)</span>
              </label>
              <input
                type="tel"
                required
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
                className="mt-0.5 accent-accent-neon shrink-0"
                checked={form.accept_terms}
                onChange={(e) => update('accept_terms', e.target.checked)}
              />
              <span>Li e aceito os termos de uso e a política de privacidade.</span>
            </label>

            <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-accent-neon shrink-0"
                checked={form.marketing_consent}
                onChange={(e) => update('marketing_consent', e.target.checked)}
              />
              <span>Quero receber e-mails com novidades e dicas.</span>
            </label>

            {/* LGPD notice */}
            <p className="text-[11px] text-text-muted leading-relaxed">
              Ao criar sua conta, você concorda com o tratamento dos seus dados conforme a{' '}
              <a
                href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-accent-neon"
              >
                Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)
              </a>
              .
            </p>

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
              <p className="text-xs text-text-muted">Verifique também a caixa de spam.</p>
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
                Enviamos um código via SMS para o celular informado.
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
              onClick={finishRegistration}
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
