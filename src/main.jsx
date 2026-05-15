import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AnimatePresence,
  LayoutGroup,
  motion
} from 'framer-motion';
import './styles.css';
import { supabase } from './lib/supabase.js';
import { acceptOrganizationInvite, createWorkspaceForUser, resolveUserOrganization } from './lib/organization.js';
import { bootstrapEmployee } from './lib/bootstrap.js';
import { isCheckedEmployee } from './lib/employees.js';
import { tabs, Sidebar, Topbar } from './components/layout.jsx';
import { ToastProvider, useToast } from './components/Toast.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Employees } from './pages/Employees.jsx';
import { Review } from './pages/Review.jsx';
import { Report } from './pages/Report.jsx';
import { Rules } from './pages/Rules.jsx';
import { Sales } from './pages/Sales.jsx';
import { Settings } from './pages/Settings.jsx';
import { Stats } from './pages/Stats.jsx';
import { EmployeeDrawer } from './components/modals.jsx';

function LeadProofLogoMark({ className = '' }) {
  return (
    <span className={`leadproof-logo-mark ${className}`.trim()} aria-hidden="true">
      <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.2l7 2.6v5.4c0 4.35-2.95 8.05-7 9.1-4.05-1.05-7-4.75-7-9.1V5.8l7-2.6z" />
        <path d="M9.25 12.1l1.8 1.8 3.95-4" />
      </svg>
    </span>
  );
}

function LeadProofBrand({ compact = false }) {
  return (
    <div className={`leadproof-brand-lockup${compact ? ' compact' : ''}`}>
      <LeadProofLogoMark />
      <div>
        <strong>LeadProof</strong>
        {!compact && <span>AI-контроль качества продаж</span>}
      </div>
    </div>
  );
}

function LoginScreen({ embedded = false, initialMode = 'login', onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const redirectTo = window.location.origin + import.meta.env.BASE_URL;
  const isRegister = mode === 'register';

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
  }, [initialMode]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    setError(null);
    setMessage(null);

    if (!trimmedEmail) {
      setError('Введите email.');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setLoading(true);

    const { data, error: err } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (!data?.session) {
      setMessage('Проверьте почту для подтверждения регистрации.');
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: embedded ? 'auto' : '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: embedded ? 0 : '32px 16px',
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 400,
        padding: '38px 36px',
        borderRadius: 32,
        background: 'rgba(252,252,253,0.96)',
        border: '1px solid rgba(255,255,255,0.82)',
        boxShadow: '0 34px 96px rgba(35,31,58,0.18)',
      }}>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 34,
              height: 34,
              borderRadius: 12,
              background: 'rgba(246,244,255,0.78)',
              color: 'var(--muted)',
              fontSize: 22,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <LeadProofLogoMark className="auth-logo-mark" />
          <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>LeadProof</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
            {isRegister ? 'Создайте аккаунт' : 'Войдите в систему'}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          padding: 5,
          marginBottom: 18,
          borderRadius: 16,
          background: 'rgba(246,244,255,0.72)',
          border: '1px solid rgba(119,101,227,0.12)',
        }}>
          {[
            ['login', 'Вход'],
            ['register', 'Регистрация'],
          ].map(([value, label]) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                disabled={loading}
                style={{
                  height: 38,
                  border: 0,
                  borderRadius: 12,
                  background: active ? 'rgba(255,255,255,0.96)' : 'transparent',
                  boxShadow: active ? '0 10px 22px rgba(119,101,227,0.12)' : 'none',
                  color: active ? 'var(--text)' : 'var(--muted)',
                  fontWeight: 700,
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <button
          className="ghost-button full"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{ marginBottom: 20, gap: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Войти через Google
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          color: 'var(--muted)',
          fontSize: 13,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          или
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        <form onSubmit={isRegister ? handleRegister : handleEmailLogin} style={{ display: 'grid', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              height: 48,
              padding: '0 14px',
              border: '1px solid var(--line)',
              borderRadius: 15,
              background: 'rgba(255,255,255,0.84)',
              color: 'var(--text)',
              fontSize: 15,
              outline: 0,
              boxSizing: 'border-box',
            }}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 6 : undefined}
            style={{
              width: '100%',
              height: 48,
              padding: '0 14px',
              border: '1px solid var(--line)',
              borderRadius: 15,
              background: 'rgba(255,255,255,0.84)',
              color: 'var(--text)',
              fontSize: 15,
              outline: 0,
              boxSizing: 'border-box',
            }}
          />
          {isRegister && (
            <input
              type="password"
              placeholder="Повторите пароль"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                height: 48,
                padding: '0 14px',
                border: '1px solid var(--line)',
                borderRadius: 15,
                background: 'rgba(255,255,255,0.84)',
                color: 'var(--text)',
                fontSize: 15,
                outline: 0,
                boxSizing: 'border-box',
              }}
            />
          )}
          {error && (
            <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{error}</p>
          )}
          {message && (
            <p style={{ margin: 0, color: 'var(--success)', fontSize: 13 }}>{message}</p>
          )}
          <button
            type="submit"
            className="primary-button full"
            disabled={loading}
          >
            {loading ? 'Загрузка…' : isRegister ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </form>

        <button
          type="button"
          className="ghost-button full"
          onClick={() => switchMode(isRegister ? 'login' : 'register')}
          disabled={loading}
          style={{ marginTop: 12 }}
        >
          {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
    </div>
  );
}

function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  useEffect(() => {
    if (!authOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setAuthOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [authOpen]);

  const previewCards = [
    ['AI анализ диалогов', 'Скоринг, ошибки и рекомендации после каждой проверки'],
    ['Контроль сотрудников', 'Статусы, динамика и фокусные зоны по каждому участнику'],
    ['Продажи и динамика', 'Сигналы по качеству сделок и изменению команды'],
    ['Отчёты и рекомендации', 'Понятные выводы для руководителя без ручной сводки'],
  ];

  const features = [
    'AI scoring',
    'mistakes detection',
    'team analytics',
    'sales tracking',
    'organization access',
  ];

  return (
    <div className="public-landing">
      <div className="landing-ambient" aria-hidden="true" />
      <header className="landing-nav">
        <LeadProofBrand />
        <button className="landing-login" onClick={() => openAuth('login')}>Войти</button>
      </header>

      <main>
        <section className="landing-hero">
          <motion.div
            className="landing-hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="landing-eyebrow">LeadProof AI Quality Control</span>
            <h1>AI-контроль качества продаж</h1>
            <p>
              Проверяйте диалоги, находите ошибки сотрудников и отслеживайте динамику команды в одном пространстве.
            </p>
            <div className="landing-actions">
              <button className="landing-primary" onClick={() => openAuth('register')}>
                Создать пространство
              </button>
              <button className="landing-secondary" onClick={() => openAuth('login')}>
                Войти
              </button>
            </div>
          </motion.div>

          <motion.div
            className="landing-preview"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="preview-topline">
              <span>Quality score</span>
              <strong>92%</strong>
            </div>
            <div className="preview-chart">
              {[62, 78, 70, 86, 82, 94].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="preview-insight">
              <b>AI рекомендация</b>
              <p>Усилить вопросы выявления потребности и контроль финального шага сделки.</p>
            </div>
          </motion.div>
        </section>

        <section className="landing-preview-grid" aria-label="Возможности LeadProof">
          {previewCards.map(([title, text], index) => (
            <motion.article
              className="landing-glass-card"
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: index * 0.05, duration: 0.42 }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </motion.article>
          ))}
        </section>

        <section className="landing-features">
          {features.map((feature) => (
            <div className="landing-feature-pill" key={feature}>{feature}</div>
          ))}
        </section>

        <section className="landing-cta">
          <div>
            <span className="landing-eyebrow">Для команды</span>
            <h2>Создайте пространство для своей команды</h2>
          </div>
          <div className="landing-actions">
            <button className="landing-primary" onClick={() => openAuth('register')}>
              Создать пространство
            </button>
            <button className="landing-secondary" onClick={() => openAuth('login')}>
              Войти
            </button>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {authOpen && (
          <motion.div
            className="public-auth-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setAuthOpen(false)}
          >
            <motion.div
              className="public-auth-modal"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <LoginScreen embedded initialMode={authMode} onClose={() => setAuthOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Root() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fire-and-forget: create/link employee record on login.
  // Runs after session is confirmed; does not block UI render.
  useEffect(() => {
    if (!session?.user) return;
    console.log('[Root] session confirmed — running bootstrapEmployee for', session.user.email);
    bootstrapEmployee(session.user)
      .then((employee) => {
        if (employee) {
          console.log('[Root] bootstrap complete — employee id:', employee.id);
        } else {
          console.warn('[Root] bootstrap returned null — check [bootstrapEmployee] logs above');
        }
      })
      .catch((err) => {
        console.error('[Root] bootstrap threw unexpected error:', err);
      });
  }, [session?.user?.id]);

  if (session === undefined) {
    return (
      <OrganizationGate
        resolution={{ status: 'loading', organizationName: '' }}
        inviteAcceptanceStatus="idle"
        inviteAcceptanceError=""
      />
    );
  }
  if (!session) return <LandingPage />;
  return <App session={session} />;
}

function getStatusTone(status) {
  if (status === 'Улучшается') return 'success';
  if (status === 'На контроле') return 'warning';
  if (status === 'Критично') return 'danger';
  if (status === 'Без изменений') return 'neutral';
  return 'neutral';
}

function toEmployee(row) {
  const status = row.status || 'На контроле';
  return {
    id: row.id,
    name: row.name,
    role: row.role === 'Сотрудник QA' ? 'Сотрудник' : row.role || 'Сотрудник',
    status,
    statusTone: getStatusTone(status),
    score: row.score ?? 0,
    dialogs: row.checks_count ?? 0,
    trend: row.trend ?? 0,
    channel: row.channel ?? '',
    auth_user_id: row.auth_user_id ?? null,
  };
}

function OrganizationGate({ resolution, inviteAcceptanceStatus, inviteAcceptanceError }) {
  const organizationName = resolution?.organizationName || 'организацию';
  const isInvite = resolution?.status === 'invite_found';
  const hasInviteError = isInvite && inviteAcceptanceStatus === 'error';
  const isLoading = resolution?.status === 'loading';
  const hasResolutionError = resolution?.status === 'error';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        padding: '34px 32px',
        borderRadius: 30,
        background: 'rgba(252,252,253,0.94)',
        border: '1px solid rgba(255,255,255,0.82)',
        boxShadow: '0 34px 96px rgba(35,31,58,0.18)',
        textAlign: 'center',
      }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 24, color: 'var(--text)' }}>
          {isLoading && 'Загружаем LeadProof...'}
          {hasResolutionError && 'Не удалось открыть рабочее пространство'}
          {hasInviteError && 'Не удалось подключить организацию'}
          {isInvite && !hasInviteError && 'Подключаем организацию...'}
          {!isLoading && !hasResolutionError && !isInvite && 'Рабочее пространство ещё не создано'}
        </h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15, lineHeight: 1.55 }}>
          {isLoading && 'Проверяем сессию и доступ к организации.'}
          {hasResolutionError && (resolution?.message || 'Обновите страницу или войдите заново.')}
          {hasInviteError && (inviteAcceptanceError || 'Проверьте приглашение и попробуйте войти снова.')}
          {isInvite && !hasInviteError && `Найдено приглашение в организацию: ${organizationName}`}
          {!isLoading && !hasResolutionError && !isInvite && 'Создание организации будет добавлено следующим шагом.'}
        </p>
      </div>
    </div>
  );
}

function OnboardingWorkspaceScreen({ user, onCreated }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Введите название организации.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await createWorkspaceForUser(supabase, user, trimmedName);
      await onCreated();
    } catch (err) {
      console.error('[Onboarding] failed:', err);
      setError(err?.message || 'Не удалось создать рабочее пространство.');
    } finally {
      setLoading(false);
    }
  };

  const helperCards = [
    'Добавьте сотрудников',
    'Настройте правила',
    'Загрузите первый диалог',
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 680,
          padding: '38px',
          borderRadius: 34,
          background: 'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(246,244,255,0.9))',
          border: '1px solid rgba(255,255,255,0.82)',
          boxShadow: '0 34px 96px rgba(35,31,58,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 52,
            height: 52,
            borderRadius: 18,
            background: 'linear-gradient(135deg,#ffffff,#eeeaff)',
            border: '1px solid rgba(119,101,227,0.18)',
            boxShadow: '0 12px 30px rgba(119,101,227,0.14)',
            color: 'var(--accent)',
            marginBottom: 18,
          }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
              <path d="M9 9h1" />
              <path d="M9 13h1" />
              <path d="M9 17h1" />
            </svg>
          </div>
          <h1 style={{ margin: '0 0 10px', fontSize: 30, color: 'var(--text)', letterSpacing: 0 }}>
            Создайте рабочее пространство
          </h1>
          <p style={{ margin: 0, maxWidth: 520, color: 'var(--muted)', fontSize: 16, lineHeight: 1.55 }}>
            Настройте LeadProof под свою команду и начните проверять диалоги.
          </p>
        </div>

        <label style={{ display: 'grid', gap: 9, marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Название организации
          </span>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError('');
            }}
            placeholder="Например: Sales Team"
            maxLength={60}
            style={{
              width: '100%',
              height: 54,
              padding: '0 16px',
              border: '1px solid rgba(119,101,227,0.18)',
              borderRadius: 18,
              background: 'rgba(255,255,255,0.82)',
              color: 'var(--text)',
              fontSize: 16,
              outline: 0,
              boxSizing: 'border-box',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
            }}
          />
        </label>

        {error && (
          <p style={{ margin: '0 0 16px', color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
            {error}
          </p>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
          margin: '18px 0 24px',
        }}>
          {helperCards.map((text) => (
            <div
              key={text}
              style={{
                padding: '14px 13px',
                borderRadius: 18,
                background: 'rgba(255,255,255,0.66)',
                border: '1px solid rgba(119,101,227,0.12)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            >
              {text}
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="primary-button full"
          disabled={loading}
          style={{ height: 52 }}
        >
          {loading ? 'Создаём...' : 'Создать пространство'}
        </button>
      </form>
    </div>
  );
}

function App({ session }) {
  const showToast = useToast();
  const [active, setActive] = useState('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [analysis, setAnalysis] = useState('idle');
  const [dashRefreshTick, setDashRefreshTick] = useState(0);

  const [organizationId, setOrganizationId] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [orgResolution, setOrgResolution] = useState(null);
  const [orgResolutionError, setOrgResolutionError] = useState('');
  const [inviteAcceptanceStatus, setInviteAcceptanceStatus] = useState('idle');
  const [inviteAcceptanceError, setInviteAcceptanceError] = useState('');
  const [employeesData, setEmployeesData] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [supabaseStatus, setSupabaseStatus] = useState('checking');
  const inviteAcceptanceKeyRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    setOrgResolution(null);
    setOrganizationId(null);
    setOrgName('');
    setEmployeesData([]);
    setEmployeesLoading(true);
    setSupabaseStatus('checking');
    setOrgResolutionError('');
    setInviteAcceptanceStatus('idle');
    setInviteAcceptanceError('');

    resolveUserOrganization(supabase, session?.user)
      .then((result) => {
        if (cancelled) return;
        setOrgResolution(result);

        if (result.status === 'member') {
          setOrganizationId(result.organizationId);
          setOrgName(result.organizationName ?? '');
          return;
        }

        setEmployeesLoading(false);
        setSupabaseStatus(result.status === 'no_user' ? 'offline' : 'connected');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[App] failed to resolve user organization:', err);
        setOrgResolution({ status: 'error', message: err?.message || 'Не удалось загрузить организацию.' });
        setOrgResolutionError(err?.message || 'Не удалось загрузить организацию.');
        setEmployeesLoading(false);
        setSupabaseStatus('offline');
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (orgResolution?.status !== 'invite_found') return;
    const inviteAcceptanceKey = `${session?.user?.id ?? 'no-user'}:${orgResolution.invite?.id ?? 'no-invite'}`;
    if (inviteAcceptanceKeyRef.current === inviteAcceptanceKey) return;
    inviteAcceptanceKeyRef.current = inviteAcceptanceKey;

    let cancelled = false;
    setInviteAcceptanceStatus('accepting');
    setInviteAcceptanceError('');

    acceptOrganizationInvite(supabase, session?.user, orgResolution.invite)
      .then(() => resolveUserOrganization(supabase, session?.user))
      .then((result) => {
        if (cancelled) return;
        setOrgResolution(result);

        if (result.status === 'member') {
          setOrganizationId(result.organizationId);
          setOrgName(result.organizationName ?? '');
          setInviteAcceptanceStatus('accepted');
          return;
        }

        throw new Error('Приглашение обработано, но организация не найдена.');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[InviteAcceptance] failed:', err);
        setInviteAcceptanceStatus('error');
        setInviteAcceptanceError(err?.message || 'Не удалось подключить организацию.');
        setEmployeesLoading(false);
        setSupabaseStatus('offline');
        inviteAcceptanceKeyRef.current = '';
      });

    return () => {
      cancelled = true;
    };
  }, [orgResolution?.status, orgResolution?.invite?.id, session?.user?.id]);

  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('employees')
      .select('id, name, role, status, channel, score, checks_count, trend, created_at, auth_user_id')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[App] fetch employees error:', error);
          setSupabaseStatus('offline');
          setEmployeesLoading(false);
          return;
        }
        setSupabaseStatus('connected');
        // Exclude cabinet/auth users — only show rows where auth_user_id is null
        setEmployeesData((data ?? []).map(toEmployee).filter(isCheckedEmployee));
        setEmployeesLoading(false);
      });
  }, [organizationId]);

  const onEmployeeAdd = (employee) => {
    if (!isCheckedEmployee(employee)) return; // never add cabinet users to checked list
    setEmployeesData((prev) => [employee, ...prev]);
  };
  const onEmployeeDelete = (id) => setEmployeesData((prev) => prev.filter((e) => e.id !== id));

  // Called after successful AI analysis to sync local state without a full refetch.
  // count = real analyzed dialogue count; newScore = score from the saved report.
  const onDialogueAnalyzed = (employeeId, count, newScore) => {
    console.log(`[PostAnalysisDataFlow] local state sync: employee=${employeeId}, +${count} dialogs, score=${newScore}`);
    setEmployeesData((prev) =>
      prev.map((e) => {
        if (e.id !== employeeId) return e;
        return {
          ...e,
          dialogs: (e.dialogs ?? 0) + count,
          ...(typeof newScore === 'number' ? { score: newScore } : {}),
        };
      })
    );
    // Increment tick so Dashboard re-fetches latest checks/reports data
    setDashRefreshTick((t) => t + 1);
  };

  const currentTitle = tabs.find((tab) => tab.id === active)?.label ?? 'Главная';

  const handleWorkspaceCreated = async () => {
    const result = await resolveUserOrganization(supabase, session?.user);
    setOrgResolution(result);

    if (result.status !== 'member') {
      throw new Error('Рабочее пространство создано, но пользователь ещё не подключён.');
    }

    setOrganizationId(result.organizationId);
    setOrgName(result.organizationName ?? '');
    setSupabaseStatus('connected');
    showToast?.('Рабочее пространство создано');
  };

  if (!orgResolution) {
    return (
      <OrganizationGate
        resolution={{ status: 'loading', organizationName: '' }}
        inviteAcceptanceStatus={inviteAcceptanceStatus}
        inviteAcceptanceError=""
      />
    );
  }

  if (orgResolution.status === 'error') {
    return (
      <OrganizationGate
        resolution={{ status: 'error', message: orgResolutionError || orgResolution.message }}
        inviteAcceptanceStatus={inviteAcceptanceStatus}
        inviteAcceptanceError=""
      />
    );
  }

  if (orgResolution.status === 'needs_onboarding') {
    return <OnboardingWorkspaceScreen user={session?.user} onCreated={handleWorkspaceCreated} />;
  }

  if (orgResolution.status === 'invite_found') {
    return (
      <OrganizationGate
        resolution={orgResolution}
        inviteAcceptanceStatus={inviteAcceptanceStatus}
        inviteAcceptanceError={inviteAcceptanceError}
      />
    );
  }

  return (
    <LayoutGroup>
      <div className="app-shell">
        <Sidebar
          active={active}
          setActive={setActive}
          user={session?.user}
          orgName={orgName}
          organizationId={organizationId}
          onOrgNameChange={setOrgName}
          systemStatus={{
            supabase: supabaseStatus,
            analysis: analysis,
            upload: supabaseStatus === 'connected' ? 'connected' : supabaseStatus,
            reports: analysis === 'complete' ? 'active' : 'checking',
          }}
        />
        <main className="workspace">
          <Topbar title={currentTitle} onNewReview={() => setActive('review')} showNewReview={active === 'dashboard'} />
          <AnimatePresence mode="wait">
            <motion.section
              key={active}
              className="page"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {active === 'dashboard' && (
                <Dashboard
                  setActive={setActive}
                  setDetailOpen={setDetailOpen}
                  setSelectedEmployee={setSelectedEmployee}
                  employees={employeesData}
                  employeesLoading={employeesLoading}
                  organizationId={organizationId}
                  refreshTick={dashRefreshTick}
                />
              )}
              {active === 'employees' && (
                <Employees
                  setDetailOpen={setDetailOpen}
                  setSelectedEmployee={setSelectedEmployee}
                  employees={employeesData}
                  employeesLoading={employeesLoading}
                  onAdd={onEmployeeAdd}
                  onDelete={onEmployeeDelete}
                  organizationId={organizationId}
                />
              )}
              {active === 'sales' && (
                <Sales
                  employees={employeesData}
                  employeesLoading={employeesLoading}
                  organizationId={organizationId}
                />
              )}
              {active === 'review' && (
                <Review
                  analysis={analysis}
                  setAnalysis={setAnalysis}
                  employees={employeesData}
                  organizationId={organizationId}
                  onDialogueAnalyzed={onDialogueAnalyzed}
                />
              )}
              {active === 'report' && <Report organizationId={organizationId} />}
              {active === 'stats' && (
                <Stats
                  employees={employeesData}
                  employeesLoading={employeesLoading}
                  organizationId={organizationId}
                />
              )}
              {active === 'rules' && <Rules organizationId={organizationId} />}
              {active === 'settings' && <Settings organizationId={organizationId} />}
            </motion.section>
          </AnimatePresence>
        </main>
        <AnimatePresence>
          {detailOpen && selectedEmployee && (
            <EmployeeDrawer
              employee={selectedEmployee}
              organizationId={organizationId}
              onClose={() => setDetailOpen(false)}
              onNewReview={() => {
                setDetailOpen(false);
                setActive('review');
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <Root />
  </ToastProvider>
);
