import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  MessageSquareText,
  UsersRound
} from 'lucide-react';
import { employees as demoEmployees, checks } from '../data/demoData.js';
import { supabase } from '../lib/supabase.js';
import { PremiumCard, RevealCard, Stagger } from '../components/shared.jsx';
import { KpiCard, TrendChart, ErrorBars } from '../components/display.jsx';

function toEmployee(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role || 'Сотрудник QA',
    score: row.score ?? 0,
    status: row.status || 'На контроле'
  };
}

export function Dashboard({ setActive, setDetailOpen, setSelectedEmployee }) {
  const [liveEmployees, setLiveEmployees] = useState([]);

  useEffect(() => {
    supabase
      .from('employees')
      .select('*')
      .then(({ data, error }) => {
        if (error) {
          console.error('[Dashboard] fetch employees error:', error);
          setLiveEmployees(demoEmployees);
          return;
        }
        setLiveEmployees((data ?? []).map(toEmployee));
      });
  }, []);

  const needsAttention = liveEmployees.filter(
    (e) => e.status === 'Критично' || e.status === 'На контроле'
  ).length;

  const topEmployees = [...liveEmployees].sort((a, b) => b.score - a.score).slice(0, 4);

  const kpis = [
    { label: 'Проверено диалогов', value: '1 284', delta: '+18% за неделю', icon: MessageSquareText },
    { label: 'Средняя оценка качества', value: '86.4', delta: '+3.2 пункта', icon: Activity },
    { label: 'Критические ошибки', value: '27', delta: '-9 за период', icon: AlertTriangle },
    {
      label: 'Сотрудников на контроле',
      value: String(liveEmployees.length || '—'),
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
        <PremiumCard className="chart-card wide" title="Динамика качества" action="Последние 8 недель">
          <TrendChart />
        </PremiumCard>
        <PremiumCard title="Топ сотрудников" action="Рейтинг">
          <div className="rank-list">
            {topEmployees.map((employee, index) => (
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
            ))}
          </div>
        </PremiumCard>
        <RevealCard title="Частые ошибки" action="Приоритеты">
          <ErrorBars />
        </RevealCard>
        <RevealCard title="Последние проверки" action="Журнал">
          <div className="check-list">
            {checks.map((item) => (
              <div className="check-row" key={item}>
                <CheckCircle2 size={17} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <motion.button className="ghost-button full" whileTap={{ scale: 0.98 }} onClick={() => setActive('review')}>
            Перейти к проверке <ChevronRight size={16} />
          </motion.button>
        </RevealCard>
      </div>
    </>
  );
}
