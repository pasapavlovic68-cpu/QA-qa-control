import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AnimatePresence,
  LayoutGroup,
  motion
} from 'framer-motion';
import './styles.css';
import { supabase } from './lib/supabase.js';
import { getOwnerOrganizationId } from './lib/organization.js';
import { tabs, Sidebar, Topbar } from './components/layout.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Employees } from './pages/Employees.jsx';
import { Review } from './pages/Review.jsx';
import { Report } from './pages/Report.jsx';
import { Rules } from './pages/Rules.jsx';
import { Settings } from './pages/Settings.jsx';
import { EmployeeDrawer } from './components/modals.jsx';

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
    role: row.role || 'Сотрудник QA',
    status,
    statusTone: getStatusTone(status),
    score: row.score ?? 0,
    dialogs: row.checks_count ?? 0,
    trend: row.trend ?? 0
  };
}

function App() {
  const [active, setActive] = useState('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [analysis, setAnalysis] = useState('idle');

  const [organizationId, setOrganizationId] = useState(null);
  const [employeesData, setEmployeesData] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [supabaseStatus, setSupabaseStatus] = useState('checking');

  useEffect(() => {
    getOwnerOrganizationId(supabase)
      .then((id) => setOrganizationId(id))
      .catch((err) => {
        console.error('[App] failed to load owner organization:', err);
        setEmployeesLoading(false);
        setSupabaseStatus('offline');
      });
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('employees')
      .select('id, name, role, status, score, checks_count, trend, created_at')
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
        setEmployeesData((data ?? []).map(toEmployee));
        setEmployeesLoading(false);
      });
  }, [organizationId]);

  const onEmployeeAdd = (employee) => setEmployeesData((prev) => [employee, ...prev]);
  const onEmployeeDelete = (id) => setEmployeesData((prev) => prev.filter((e) => e.id !== id));

  const currentTitle = tabs.find((tab) => tab.id === active)?.label ?? 'Главная';

  return (
    <LayoutGroup>
      <div className="app-shell">
        <Sidebar
          active={active}
          setActive={setActive}
          systemStatus={{
            supabase: supabaseStatus,
            analysis: analysis,
            upload: 'beta',
            reports: analysis === 'complete' ? 'active' : 'beta',
            pdf: 'not_implemented'
          }}
        />
        <main className="workspace">
          <Topbar title={currentTitle} onNewReview={() => setActive('review')} />
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
              {active === 'review' && (
                <Review
                  analysis={analysis}
                  setAnalysis={setAnalysis}
                  employees={employeesData}
                  organizationId={organizationId}
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

createRoot(document.getElementById('root')).render(<App />);
