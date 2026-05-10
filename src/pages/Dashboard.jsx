import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  MessageSquareText,
  UsersRound
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { PremiumCard, RevealCard, Stagger } from '../components/shared.jsx';
import { KpiCard, TrendChart } from '../components/display.jsx';

const emptyCardText = (text) => (
  <p style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.875rem', padding: '24px 0' }}>{text}</p>
);

export function Dashboard({ setActive, setDetailOpen, setSelectedEmployee, employees, employeesLoading, organizationId }) {
  const [checks, setChecks] = useState([]);
  const [reports, setReports] = useState([]);
  const [dashLoading, setDashLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
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
  }, [organizationId]);

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
      icon: UsersRound
    }
  ];

  return (
    <>
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
          <motion.button className="ghost-button full" whileTap={{ scale: 0.98 }} onClick={() => setActive('review')}>
            Перейти к проверке <ChevronRight size={16} />
          </motion.button>
        </RevealCard>
      </div>
    </>
  );
}
