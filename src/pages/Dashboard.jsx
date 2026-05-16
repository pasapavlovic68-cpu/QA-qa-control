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
import { PremiumCard, RevealCard, ScrollReveal, Stagger, Avatar } from '../components/shared.jsx';
import { KpiCard, PremiumDropdown } from '../components/display.jsx';
import { ModalPortal, modalContentVariants, modalSectionVariants, useModalScrollLock } from '../components/modal.jsx';

const emptyCardText = (text) => (
  <p style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.875rem', padding: '24px 0' }}>{text}</p>
);

const dashboardSharedTransition = {
  layout: { type: 'spring', damping: 34, stiffness: 360 },
  opacity: { duration: 0.18 },
  scale: { duration: 0.18 },
};

function scoreColor(score) {
  if (score >= 85) return 'var(--success)';
  if (score >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

function controlReason(empId, latestScoreByEmployee, criticalByEmployee, mistakesByEmployee) {
  const score = latestScoreByEmployee[empId];
  const crits = criticalByEmployee[empId]?.count ?? 0;
  if (score !== undefined && score < 70) return 'Низкая оценка';
  if (crits > 0) return 'Критичные ошибки';
  return 'Есть замечания';
}

function EmployeesControlModal({ employees, criticalByEmployee, latestScoreByEmployee, mistakesByEmployee, layoutId, onClose }) {
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
          layoutId={layoutId}
          className="modal-shell modal-shell--medium"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          transition={dashboardSharedTransition}
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
                Сотрудников на контроле пока нет.
              </motion.p>
            ) : (
              <motion.div variants={modalSectionVariants} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                {employees.map((emp) => {
                  const crits = criticalByEmployee[emp.id] ?? { count: 0 };
                  const latestScore = latestScoreByEmployee[emp.id];
                  const reason = controlReason(emp.id, latestScoreByEmployee, criticalByEmployee, mistakesByEmployee);
                  const reasonColor = reason === 'Критичные ошибки' || reason === 'Низкая оценка'
                    ? 'var(--danger)'
                    : 'var(--warning)';
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
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: reasonColor, opacity: 0.88, fontWeight: 600 }}>
                          {reason}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <strong style={{ fontSize: '1.15rem', color: scoreColor(latestScore ?? emp.score), lineHeight: 1 }}>
                          {latestScore ?? emp.score}
                        </strong>
                        {crits.count > 0 && (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(190,60,68,0.09)', color: 'var(--danger)', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>
                            {crits.count} критич.
                          </span>
                        )}
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

function DashboardEmployeeDetailModal({
  employee,
  latestScore,
  checksCount,
  dialoguesCount,
  criticalInfo,
  mistakesCount,
  latestReport,
  layoutId,
  onClose,
}) {
  useModalScrollLock();
  const mistakes = Array.isArray(latestReport?.mistakes) ? latestReport.mistakes : [];
  const issueItems = mistakes.slice(0, 4);
  const recommendations = mistakes
    .map((m) => m.recommendation || m.recommendation_text || m.fix || null)
    .filter(Boolean)
    .slice(0, 3);

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
          layoutId={layoutId}
          className="modal-shell modal-shell--medium"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          transition={dashboardSharedTransition}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Топ сотрудников</span>
                <h2 style={{ margin: '2px 0 0', fontSize: 20 }}>{employee.name}</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            <motion.div variants={modalSectionVariants} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <Avatar name={employee.name} large />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>{employee.name}</p>
                <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>{employee.role}</p>
              </div>
              <strong style={{ marginLeft: 'auto', color: scoreColor(latestScore ?? employee.score), fontSize: '1.5rem', lineHeight: 1 }}>
                {latestScore ?? employee.score}
              </strong>
            </motion.div>

            <motion.div className="mini-metrics" variants={modalSectionVariants}>
              <div className="metric"><span>Проверок</span><strong>{checksCount}</strong></div>
              <div className="metric"><span>Диалогов</span><strong>{dialoguesCount}</strong></div>
              <div className="metric"><span>Ошибок</span><strong>{mistakesCount}</strong></div>
            </motion.div>

            <motion.div variants={modalSectionVariants} style={{ marginTop: 18 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '0.9rem' }}>Критичные замечания</p>
              {criticalInfo?.count > 0 ? (
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(190,60,68,0.08)', border: '1px solid rgba(190,60,68,0.14)', color: 'var(--danger)', fontSize: '0.84rem', lineHeight: 1.5 }}>
                  {criticalInfo.count} критич. · {criticalInfo.latest || 'Есть критичные или важные ошибки'}
                </div>
              ) : (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.84rem' }}>Критичных замечаний не найдено.</p>
              )}
            </motion.div>

            <motion.div variants={modalSectionVariants} style={{ marginTop: 18 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '0.9rem' }}>Ошибки</p>
              {issueItems.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {issueItems.map((item, index) => (
                    <div key={`${item.title || item.description || 'mistake'}-${index}`} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.62)', border: '1px solid var(--line)', fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.45 }}>
                      {item.title || item.description || 'Ошибка'}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.84rem' }}>Ошибок в последнем отчёте не найдено.</p>
              )}
            </motion.div>

            <motion.div variants={modalSectionVariants} style={{ marginTop: 18 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '0.9rem' }}>Рекомендации</p>
              {recommendations.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {recommendations.map((item, index) => (
                    <div key={`${item}-${index}`} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(119,101,227,0.08)', border: '1px solid rgba(119,101,227,0.14)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.84rem' }}>Рекомендации появятся в отчётах после анализа.</p>
              )}
            </motion.div>

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

const MAX_BAR_H = 72;
const MAX_BAR_H_COMPACT = 56;

function dayColor(score) {
  if (score === null) return 'rgba(119,101,227,0.15)';
  if (score >= 85) return 'var(--success)';
  if (score >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

function QualityChart({ days, summary, loading, compact, employeeFiltered }) {
  if (loading) return <p className="qtc-empty">Загружаем…</p>;

  const hasSomeData = days.some((d) => d.avgScore !== null);
  if (!hasSomeData)
    return (
      <p className="qtc-empty">
        {employeeFiltered
          ? `Нет данных за последние ${days.length} дней для выбранного сотрудника.`
          : `Данных за последние ${days.length} дней нет. Динамика появится после AI‑анализа диалогов.`}
      </p>
    );

  const maxH = compact ? MAX_BAR_H_COMPACT : MAX_BAR_H;
  const minFill = compact ? 3 : 8;
  const emptyFill = compact ? 2 : 4;

  return (
    <div className="qtc-wrap">
      <div className={`qtc-bars${compact ? ' qtc-bars--compact' : ''}`}>
        {days.map((d, i) => {
          const has = d.avgScore !== null;
          const fillH = has ? Math.max(Math.round((d.avgScore / 100) * maxH), minFill) : emptyFill;
          const color = dayColor(d.avgScore);
          return (
            <div key={d.dayKey} className={`qtc-col${compact ? ' qtc-col--compact' : ''}`}>
              <div className="qtc-bar-area">
                {!compact && has && (
                  <span className="qtc-score-label" style={{ color }}>
                    {d.avgScore}
                  </span>
                )}
                <div className="qtc-bar-bg">
                  <motion.div
                    className="qtc-bar-fill"
                    style={{ background: color, opacity: has ? 0.88 : 0.4, height: 0 }}
                    animate={{ height: fillH }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * (compact ? 0.02 : 0.06) }}
                  />
                </div>
              </div>
              {d.showLabel && (
                <span className="qtc-day-label" style={{ opacity: has ? 1 : 0.38 }}>
                  {d.label}
                </span>
              )}
              {!compact && has && d.count > 1 && (
                <span className="qtc-count-label">{d.count} отч.</span>
              )}
            </div>
          );
        })}
      </div>

      {summary && (
        <div className="qtc-summary">
          <div className="qtc-stat-item">
            <span>{summary.periodDays} дн. ср.</span>
            <strong style={{ color: dayColor(summary.overall) }}>{summary.overall}</strong>
          </div>
          <div className="qtc-divider" />
          <div className="qtc-stat-item">
            <span>Лучший день</span>
            <strong style={{ color: 'var(--success)' }}>
              {summary.best.label} · {summary.best.avgScore}
            </strong>
          </div>
          <div className="qtc-divider" />
          <div className="qtc-stat-item">
            <span>Худший день</span>
            <strong style={{ color: 'var(--danger)' }}>
              {summary.worst.label} · {summary.worst.avgScore}
            </strong>
          </div>
          <div className="qtc-divider" />
          <div className="qtc-stat-item">
            <span>Тренд</span>
            <strong
              style={{
                color:
                  summary.trend === 'growth'
                    ? 'var(--success)'
                    : summary.trend === 'decline'
                    ? 'var(--danger)'
                    : 'var(--muted)',
              }}
            >
              {summary.trend === 'growth'
                ? '↑ Рост'
                : summary.trend === 'decline'
                ? '↓ Снижение'
                : '→ Стабильно'}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}

export function Dashboard({ setActive, setDetailOpen, setSelectedEmployee, employees, employeesLoading, organizationId, refreshTick }) {
  const [checks, setChecks] = useState([]);
  const [reports, setReports] = useState([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [employeesModalOpen, setEmployeesModalOpen] = useState(false);
  const [dashboardEmployeeDetail, setDashboardEmployeeDetail] = useState(null);
  const [trendEmployeeId, setTrendEmployeeId] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState(7);

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
    const valid = reports.filter((r) => r.score != null);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((acc, r) => acc + r.score, 0) / valid.length);
  }, [reports]);

  const totalCritical = useMemo(
    () => completedChecks.reduce((sum, c) => sum + (c.critical_errors_count || 0), 0),
    [completedChecks]
  );

  // Critical/high mistakes per employee (across all reports)
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

  // Per-employee latest report score (reports sorted DESC so first = latest)
  const latestScoreByEmployee = useMemo(() => {
    const map = {};
    reports.forEach((r) => {
      if (map[r.employee_id] === undefined) map[r.employee_id] = r.score ?? 0;
    });
    return map;
  }, [reports]);

  const latestReportByEmployee = useMemo(() => {
    const map = {};
    reports.forEach((r) => {
      if (!map[r.employee_id]) map[r.employee_id] = r;
    });
    return map;
  }, [reports]);

  // Total mistake count (any severity) per employee across all reports
  const mistakesByEmployee = useMemo(() => {
    const map = {};
    reports.forEach((r) => {
      const total = (Array.isArray(r.mistakes) ? r.mistakes : []).length;
      map[r.employee_id] = (map[r.employee_id] ?? 0) + total;
    });
    return map;
  }, [reports]);

  const checksByEmployee = useMemo(() => {
    const map = {};
    completedChecks.forEach((c) => {
      if (!map[c.employee_id]) map[c.employee_id] = { checks: 0, dialogues: 0 };
      map[c.employee_id].checks += 1;
      map[c.employee_id].dialogues += c.dialogues_count || 0;
    });
    return map;
  }, [completedChecks]);

  // Employees actually "under control": must have at least one report AND a real issue
  const employeesUnderControl = useMemo(() => {
    return employees.filter((emp) => {
      if (latestScoreByEmployee[emp.id] === undefined) return false; // no reports — skip
      const score = latestScoreByEmployee[emp.id];
      const crits = criticalByEmployee[emp.id]?.count ?? 0;
      const mistakes = mistakesByEmployee[emp.id] ?? 0;
      return score < 70 || crits > 0 || mistakes > 0;
    });
  }, [employees, latestScoreByEmployee, criticalByEmployee, mistakesByEmployee]);

  // Top employees: score >= 80, max 3, sorted by latest score DESC
  const topEmployees = useMemo(() => {
    return employees
      .filter((e) => latestScoreByEmployee[e.id] !== undefined && latestScoreByEmployee[e.id] >= 80)
      .sort((a, b) => (latestScoreByEmployee[b.id] ?? 0) - (latestScoreByEmployee[a.id] ?? 0))
      .slice(0, 3);
  }, [employees, latestScoreByEmployee]);

  const employeeMap = useMemo(() => {
    const map = {};
    employees.forEach((e) => { map[e.id] = e; });
    return map;
  }, [employees]);

  const trendDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compact = trendPeriod === 30;
    return Array.from({ length: trendPeriod }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (trendPeriod - 1 - i));
      const dayStart = day.getTime();
      const dayEnd = dayStart + 86400000;
      const dayReports = reports.filter((r) => {
        if (!r.created_at) return false;
        if (trendEmployeeId && r.employee_id !== trendEmployeeId) return false;
        const t = new Date(r.created_at).getTime();
        return t >= dayStart && t < dayEnd;
      });
      const avgScore =
        dayReports.length > 0
          ? Math.round(dayReports.reduce((s, r) => s + (r.score ?? 0), 0) / dayReports.length)
          : null;
      let label;
      let showLabel;
      if (!compact) {
        const weekday = day.toLocaleDateString('ru-RU', { weekday: 'short' });
        label = weekday.charAt(0).toUpperCase() + weekday.slice(1) + ' ' + day.getDate();
        showLabel = true;
      } else {
        showLabel = i % 5 === 0 || i === trendPeriod - 1;
        label = showLabel
          ? day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
          : '';
      }
      return { dayKey: day.toISOString().slice(0, 10), label, showLabel, avgScore, count: dayReports.length };
    });
  }, [reports, trendPeriod, trendEmployeeId]);

  const trendSummary = useMemo(() => {
    const filled = trendDays.filter((d) => d.avgScore !== null);
    if (filled.length === 0) return null;
    const overall = Math.round(filled.reduce((s, d) => s + d.avgScore, 0) / filled.length);
    const best = filled.reduce((a, b) => (b.avgScore > a.avgScore ? b : a));
    const worst = filled.reduce((a, b) => (b.avgScore < a.avgScore ? b : a));
    let trend = 'stable';
    if (filled.length >= 2) {
      const delta = filled[filled.length - 1].avgScore - filled[0].avgScore;
      if (delta >= 3) trend = 'growth';
      else if (delta <= -3) trend = 'decline';
    }
    return { overall, best, worst, trend, periodDays: trendPeriod };
  }, [trendDays, trendPeriod]);

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

  const trendEmployeeValue = trendEmployeeId
    ? employees.find((emp) => emp.id === trendEmployeeId)?.name ?? 'Все'
    : 'Все';
  const trendEmployeeOptions = useMemo(
    () => ['Все', ...employees.map((emp) => emp.name)],
    [employees]
  );

  const handleTrendEmployeeChange = (name) => {
    if (name === 'Все') {
      setTrendEmployeeId(null);
      return;
    }
    const selected = employees.find((emp) => emp.name === name);
    setTrendEmployeeId(selected?.id ?? null);
  };

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
      value: dashLoading || employeesLoading ? '…' : employeesUnderControl.length > 0 ? String(employeesUnderControl.length) : '—',
      delta: employeesUnderControl.length > 0 ? `${employeesUnderControl.length} требуют внимания` : 'Нет сотрудников с проблемами',
      icon: UsersRound,
      onClick: () => setEmployeesModalOpen(true)
    }
  ];

  return (
    <>
      <AnimatePresence>
        {employeesModalOpen && (
          <EmployeesControlModal
            employees={employeesUnderControl}
            criticalByEmployee={criticalByEmployee}
            latestScoreByEmployee={latestScoreByEmployee}
            mistakesByEmployee={mistakesByEmployee}
            layoutId="dashboard-controlled-employees"
            onClose={() => setEmployeesModalOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {dashboardEmployeeDetail && (
          <DashboardEmployeeDetailModal
            employee={dashboardEmployeeDetail}
            latestScore={latestScoreByEmployee[dashboardEmployeeDetail.id]}
            checksCount={checksByEmployee[dashboardEmployeeDetail.id]?.checks ?? 0}
            dialoguesCount={checksByEmployee[dashboardEmployeeDetail.id]?.dialogues ?? dashboardEmployeeDetail.dialogs ?? 0}
            criticalInfo={criticalByEmployee[dashboardEmployeeDetail.id] ?? { count: 0, latest: null }}
            mistakesCount={mistakesByEmployee[dashboardEmployeeDetail.id] ?? 0}
            latestReport={latestReportByEmployee[dashboardEmployeeDetail.id]}
            layoutId={`dashboard-top-employee-${dashboardEmployeeDetail.id}`}
            onClose={() => setDashboardEmployeeDetail(null)}
          />
        )}
      </AnimatePresence>
      <Stagger className="kpi-grid">
        {kpis.map((kpi) => {
          if (kpi.label !== 'Сотрудников на контроле') return <KpiCard key={kpi.label} {...kpi} />;
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              layout
              layoutId="dashboard-controlled-employees"
              className="kpi-card"
              whileHover={{ y: -5, boxShadow: '0 22px 60px rgba(92, 82, 143, 0.13)' }}
              onClick={kpi.onClick}
              transition={dashboardSharedTransition}
              style={{ cursor: 'pointer' }}
            >
              <div className="kpi-icon"><Icon size={20} /></div>
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
              <small>{kpi.delta}</small>
            </motion.div>
          );
        })}
      </Stagger>
      <div className="dashboard-grid">
        <RevealCard className="chart-card wide" title="Динамика качества" action={`Последние ${trendPeriod} дней`}>
          <div className="qtc-filters">
            <div className="qtc-filter-group qtc-employee-select">
              <PremiumDropdown
                value={trendEmployeeValue}
                options={trendEmployeeOptions}
                onChange={handleTrendEmployeeChange}
              />
            </div>
            <div className="qtc-filter-group qtc-filter-group--right">
              {[7, 30].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`qtc-pill${trendPeriod === p ? ' active' : ''}`}
                  onClick={() => setTrendPeriod(p)}
                >
                  {p} дн.
                </button>
              ))}
            </div>
          </div>
          <QualityChart
            days={trendDays}
            summary={trendSummary}
            loading={dashLoading}
            compact={trendPeriod === 30}
            employeeFiltered={trendEmployeeId !== null}
          />
        </RevealCard>
        <RevealCard title="Топ сотрудников" action="Рейтинг" className="dashboard-fixed-card">
          <div className="dashboard-card-scroll">
            <div className="rank-list">
              {dashLoading || employeesLoading
                ? emptyCardText('Загружаем…')
                : topEmployees.length > 0
                ? topEmployees.map((employee, index) => {
                    const score = latestScoreByEmployee[employee.id] ?? employee.score;
                    return (
                      <motion.button
                        className="rank-row"
                        key={employee.id}
                        layout
                        layoutId={`dashboard-top-employee-${employee.id}`}
                        whileHover={{ x: 4 }}
                        transition={dashboardSharedTransition}
                        onClick={() => setDashboardEmployeeDetail(employee)}
                      >
                        <span className="rank">{index + 1}</span>
                        <span>
                          <strong>{employee.name}</strong>
                          <small>{employee.role}</small>
                        </span>
                        <b style={{ color: scoreColor(score) }}>{score}</b>
                      </motion.button>
                    );
                  })
                : emptyCardText('Нет сотрудников с показателем 80% и выше.')}
            </div>
          </div>
        </RevealCard>
        <RevealCard title="Частые ошибки" action="Приоритеты" className="dashboard-fixed-card">
          <div className="dashboard-card-scroll">
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
          </div>
        </RevealCard>
        <RevealCard title="Последние проверки" action="Журнал" className="dashboard-fixed-card">
          <div className="dashboard-card-scroll">
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
          </div>
        </RevealCard>
      </div>
    </>
  );
}
