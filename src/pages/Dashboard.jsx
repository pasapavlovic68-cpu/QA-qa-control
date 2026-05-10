import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  MessageSquareText,
  UsersRound,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { PremiumCard, RevealCard, Stagger, Avatar } from '../components/shared.jsx';
import { KpiCard, TrendChart } from '../components/display.jsx';
import { ModalPortal, modalMotion, modalContentVariants, modalSectionVariants, useModalScrollLock } from '../components/modal.jsx';

const emptyCardText = (text) => (
  <p style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.875rem', padding: '24px 0' }}>{text}</p>
);

function scoreColor(score) {
  if (score >= 85) return 'var(--success)';
  if (score >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

function EmployeesControlModal({ employees, criticalByEmployee, onClose }) {
  useModalScrollLock();
  return (
    <ModalPortal>
      <motion.div
        className="modal-backdrop employee-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-shell modal-shell--medium"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          initial={modalMotion.initial}
          animate={modalMotion.animate}
          exit={modalMotion.exit}
          transition={modalMotion.transition}
          style={{ overflowY: 'auto', maxHeight: '90vh' }}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Контроль качества</span>
                <h2 style={{ margin: '2px 0 0', fontSize: 20 }}>Сотрудники на контроле</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            {employees.length === 0 ? (
              <motion.p variants={modalSectionVariants} style={{ textAlign: 'center', opacity: 0.4, padding: '32px 0' }}>
                Сотрудники пока не добавлены.
              </motion.p>
            ) : (
              <motion.div variants={modalSectionVariants} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                {employees.map((emp) => {
                  const crits = criticalByEmployee[emp.id] ?? { count: 0, latest: null };
                  return (
                    <motion.div
                      key={emp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 16px',
                        borderRadius: 16,
                        background: 'rgba(255,255,255,0.6)',
                        border: '1px solid var(--line)',
                        backdropFilter: 'blur(8px)',
                      }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Avatar name={emp.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>{emp.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                          {emp.role} · {emp.dialogs ?? 0} диалогов
                        </p>
                        {crits.latest ? (
                          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--danger)', opacity: 0.82, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {crits.latest}
                          </p>
                        ) : (
                          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--success)', opacity: 0.72 }}>
                            Нет критичных ошибок
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <strong style={{ fontSize: '1.15rem', color: scoreColor(emp.score), lineHeight: 1 }}>{emp.score}</strong>
                        {crits.count > 0 && (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(190,60,68,0.09)', color: 'var(--danger)', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>
                            {crits.count} критич.
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', background: 'rgba(119,101,227,0.07)', borderRadius: 8, padding: '2px 8px' }}>
                          {emp.status}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            <motion.div className="modal-actions" variants={modalSectionVariants} style={{ marginTop: 20 }}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
                Закрыть
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

export function Dashboard({ setActive, setDetailOpen, setSelectedEmployee, employees, employeesLoading, organizationId, refreshTick }) {
  const [checks, setChecks] = useState([]);
  const [reports, setReports] = useState([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [employeesModalOpen, setEmployeesModalOpen] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    console.log(`[PostAnalysisDataFlow] Dashboard re-fetching checks+reports (tick=${refreshTick})`);
    setDashLoading(true);
    Promise.all([
      supabase
        .from('qa_checks')
        .select('id, employee_id, status, dialogues_count, critical_errors_count, score, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('reports')
        .select('id, employee_id, score, mistakes, title, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
    ]).then(([checksResult, reportsResult]) => {
      if (!checksResult.error) setChecks(checksResult.data ?? []);
      else console.error('[Dashboard] checks fetch error:', checksResult.error);
      if (!reportsResult.error) setReports(reportsResult.data ?? []);
      else console.error('[Dashboard] reports fetch error:', reportsResult.error);
      setDashLoading(false);
    });
  }, [organizationId, refreshTick]);

  const completedChecks = useMemo(
    () => checks.filter((c) => c.status === 'complete'),
    [checks]
  );

  const totalDialogs = useMemo(
    () => completedChecks.reduce((sum, c) => sum + (c.dialogues_count || 0), 0),
    [completedChecks]
  );

  const avgScore = useMemo(() => {
    if (reports.length === 0) return null;
    const sum = reports.reduce((acc, r) => acc + (r.score ?? 0), 0);
    return Math.round(sum / reports.length);
  }, [reports]);

  const totalCritical = useMemo(
    () => completedChecks.reduce((sum, c) => sum + (c.critical_errors_count || 0), 0),
    [completedChecks]
  );

  const needsAttention = employees.filter(
    (e) => e.status === 'Критично' || e.status === 'На контроле'
  ).length;

  const topEmployees = useMemo(
    () => [...employees].sort((a, b) => b.score - a.score).slice(0, 4),
    [employees]
  );

  const employeeMap = useMemo(() => {
    const map = {};
    employees.forEach((e) => { map[e.id] = e; });
    return map;
  }, [employees]);

  const trendScores = useMemo(
    () =>
      [...reports]
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(-8)
        .map((r) => r.score ?? 0),
    [reports]
  );

  const topErrors = useMemo(() => {
    const counts = {};
    reports.forEach((r) => {
      (Array.isArray(r.mistakes) ? r.mistakes : []).forEach((m) => {
        const key = m.title || m.description || 'Ошибка';
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [reports]);

  const criticalByEmployee = useMemo(() => {
    const map = {};
    reports.forEach((r) => {
      const crits = (Array.isArray(r.mistakes) ? r.mistakes : []).filter(
        (m) => m.severity === 'critical' || m.severity === 'high'
      );
      if (!map[r.employee_id]) map[r.employee_id] = { count: 0, latest: null };
      map[r.employee_id].count += crits.length;
      if (!map[r.employee_id].latest && crits.length > 0) {
        map[r.employee_id].latest = crits[0].title || crits[0].description || null;
      }
    });
    return map;
  }, [reports]);

  const latestChecks = useMemo(
    () =>
      completedChecks.slice(0, 4).map((c) => ({
        id: c.id,
        employee: employeeMap[c.employee_id]?.name || 'Сотрудник',
        score: c.score ?? 0,
        date: c.created_at ? new Date(c.created_at).toLocaleDateString('ru-RU') : '',
      })),
    [completedChecks, employeeMap]
  );

  const kpis = [
    {
      label: 'Проверено диалогов',
      value: dashLoading ? '…' : String(totalDialogs),
      delta: dashLoading ? '' : totalDialogs === 0 ? 'Проверки не запущены' : `из ${completedChecks.length} проверок`,
      icon: MessageSquareText
    },
    {
      label: 'Средняя оценка качества',
      value: dashLoading ? '…' : avgScore !== null ? String(avgScore) : '—',
      delta: dashLoading ? '' : avgScore !== null ? `по ${reports.length} отчётам` : 'Нет данных',
      icon: Activity
    },
    {
      label: 'Критические ошибки',
      value: dashLoading ? '…' : String(totalCritical),
      delta: dashLoading ? '' : completedChecks.length === 0 ? 'Нет данных' : `за ${completedChecks.length} проверок`,
      icon: AlertTriangle
    },
    {
      label: 'Сотрудников на контроле',
      value: employeesLoading ? '…' : String(employees.length || '—'),
      delta: needsAttention > 0 ? `${needsAttention} требуют внимания` : 'Всё в порядке',
      icon: UsersRound,
      onClick: () => setEmployeesModalOpen(true)
    }
  ];

  return (
    <>
      <AnimatePresence>
        {employeesModalOpen && (
          <EmployeesControlModal
            employees={employees}
            criticalByEmployee={criticalByEmployee}
            onClose={() => setEmployeesModalOpen(false)}
          />
        )}
      </AnimatePresence>
      <Stagger className="kpi-grid">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </Stagger>
      <div className="dashboard-grid">
        <PremiumCard className="chart-card wide" title="Динамика качества" action="Последние 8 проверок">
          {trendScores.length >= 2
            ? <TrendChart data={trendScores} />
            : emptyCardText('Динамика появится после первых проверок.')}
        </PremiumCard>
        <PremiumCard title="Топ сотрудников" action="Рейтинг">
          <div className="rank-list">
            {topEmployees.length > 0
              ? topEmployees.map((employee, index) => (
                <motion.button
                  className="rank-row"
                  key={employee.id}
                  whileHover={{ x: 4 }}
                  onClick={() => {
                    setSelectedEmployee(employee);
                    setDetailOpen(true);
                  }}
                >
                  <span className="rank">{index + 1}</span>
                  <span>
                    <strong>{employee.name}</strong>
                    <small>{employee.role}</small>
                  </span>
                  <b>{employee.score}</b>
                </motion.button>
              ))
              : emptyCardText(employeesLoading ? 'Загружаем…' : 'Сотрудники пока не добавлены.')}
          </div>
        </PremiumCard>
        <RevealCard title="Частые ошибки" action="Приоритеты">
          {topErrors.length > 0
            ? (
              <div className="error-bars">
                {topErrors.map(([title, count]) => (
                  <div className="bar-row" key={title}>
                    <div><span>{title}</span><b>{count}</b></div>
                    <div className="bar-track">
                      <motion.span
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(count * 20, 100)}%` }}
                        transition={{ duration: 0.7 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
            : emptyCardText(dashLoading ? 'Загружаем…' : 'Ошибки появятся после AI-анализа диалогов.')}
        </RevealCard>
        <RevealCard title="Последние проверки" action="Журнал">
          {latestChecks.length > 0
            ? (
              <div className="rank-list">
                {latestChecks.map((check) => (
                  <div className="rank-row" key={check.id} style={{ cursor: 'default' }}>
                    <span className="rank">{check.score}</span>
                    <span>
                      <strong>{check.employee}</strong>
                      <small>{check.date}</small>
                    </span>
                  </div>
                ))}
              </div>
            )
            : emptyCardText(dashLoading ? 'Загружаем…' : 'Проверок пока нет.')}
        </RevealCard>
      </div>
    </>
  );
}
