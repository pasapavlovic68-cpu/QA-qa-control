import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AnimatePresence,
  LayoutGroup,
  motion
} from 'framer-motion';
import './styles.css';
import { supabase } from './lib/supabase.js';
import { resolveUserOrganization } from './lib/organization.js';
import { bootstrapEmployee } from './lib/bootstrap.js';
import { isCheckedEmployee } from './lib/employees.js';
import { tabs, Sidebar, Topbar } from './components/layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Employees } from './pages/Employees.jsx';
import { Review } from './pages/Review.jsx';
import { Report } from './pages/Report.jsx';
import { Rules } from './pages/Rules.jsx';
import { Sales } from './pages/Sales.jsx';
import { Settings } from './pages/Settings.jsx';
import { EmployeeDrawer } from './components/modals.jsx';

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const redirectTo = window.location.origin + import.meta.env.BASE_URL;

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
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
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '38px 36px',
        borderRadius: 32,
        background: 'rgba(252,252,253,0.96)',
        border: '1px solid rgba(255,255,255,0.82)',
        boxShadow: '0 34px 96px rgba(35,31,58,0.18)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            borderRadius: 16,
            background: 'linear-gradient(135deg,#ffffff,#eeeaff)',
            border: '1px solid rgba(119,101,227,0.18)',
            boxShadow: '0 10px 28px rgba(119,101,227,0.12)',
            color: 'var(--accent)',
            marginBottom: 14,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="4"/>
            </svg>
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>LeadProof</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>Войдите в систему</p>
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

        <form onSubmit={handleEmailLogin} style={{ display: 'grid', gap: 12 }}>
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
          {error && (
            <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{error}</p>
          )}
          <button
            type="submit"
            className="primary-button full"
            disabled={loading}
          >
            {loading ? 'Загрузка…' : 'Войти'}
          </button>
        </form>
      </div>
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

  if (session === undefined) return null;
  if (!session) return <LoginScreen />;
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
    auth_user_id: row.auth_user_id ?? null,
  };
}

function OrganizationGate({ resolution }) {
  const organizationName = resolution?.organizationName || 'организацию';
  const isInvite = resolution?.status === 'invite_found';

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
          {isInvite
            ? `Найдено приглашение в организацию: ${organizationName}`
            : 'Рабочее пространство ещё не создано'}
        </h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15, lineHeight: 1.55 }}>
          {isInvite
            ? 'Подключение по приглашению будет добавлено следующим шагом.'
            : 'Создание организации будет добавлено следующим шагом.'}
        </p>
      </div>
    </div>
  );
}

function App({ session }) {
  const [active, setActive] = useState('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [analysis, setAnalysis] = useState('idle');
  const [dashRefreshTick, setDashRefreshTick] = useState(0);

  const [organizationId, setOrganizationId] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [orgResolution, setOrgResolution] = useState(null);
  const [employeesData, setEmployeesData] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [supabaseStatus, setSupabaseStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    setOrgResolution(null);
    setOrganizationId(null);
    setOrgName('');
    setEmployeesData([]);
    setEmployeesLoading(true);
    setSupabaseStatus('checking');

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
        setEmployeesLoading(false);
        setSupabaseStatus('offline');
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('employees')
      .select('id, name, role, status, score, checks_count, trend, created_at, auth_user_id')
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

  if (!orgResolution) return null;

  if (orgResolution.status === 'invite_found' || orgResolution.status === 'needs_onboarding') {
    return <OrganizationGate resolution={orgResolution} />;
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
            upload: 'beta',
            reports: analysis === 'complete' ? 'active' : 'beta',
            pdf: 'not_implemented'
          }}
        />
        <main className="workspace">
          <Topbar title={currentTitle} onNewReview={() => setActive('review')} showNewReview={active === 'dashboard'} />
          <AnimatePresence mode="wait">
            <motion.section
              key={active}
              className="page"
              initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
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
