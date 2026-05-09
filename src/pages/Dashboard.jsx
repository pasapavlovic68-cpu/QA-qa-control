import { useState, useEffect } from 'react';
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
import { KpiCard } from '../components/display.jsx';

function toEmployee(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role || 'Сотрудник QA',
    score: row.score ?? 0,
    status: row.status || 'На контроле'
  };
}

const emptyCardText = (text) => (
  <p style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.875rem', padding: '24px 0' }}>{text}</p>
);

export function Dashboard({ setActive, setDetailOpen, setSelectedEmployee }) {
  const [liveEmployees, setLiveEmployees] = useState([]);

  useEffect(() => {
    supabase
      .from('employees')
      .select('*')
      .then(({ data, error }) => {
        if (error) {
          console.error('[Dashboard] fetch employees error:', error);
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
    { label: 'Проверено диалогов', value: '0', delta: 'Проверки не запущены', icon: MessageSquareText },
    { label: 'Средняя оценка качества', value: '—', delta: 'Нет данных', icon: Activity },
    { label: 'Критические ошибки', value: '0', delta: 'Нет данных', icon: AlertTriangle },
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
          {emptyCardText('Динамика появится после первых проверок.')}
        </PremiumCard>
        <PremiumCard title="Топ сотрудников" action="Рейтинг">
          <div className="rank-list">
            {topEmployees.length > 0 ? topEmployees.map((employee, index) => (
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
            )) : emptyCardText('Сотрудники пока не добавлены.')}
          </div>
        </PremiumCard>
        <RevealCard title="Частые ошибки" action="Приоритеты">
          {emptyCardText('Ошибки появятся после AI-анализа диалогов.')}
        </RevealCard>
        <RevealCard title="Последние проверки" action="Журнал">
          {emptyCardText('Проверок пока нет.')}
          <motion.button className="ghost-button full" whileTap={{ scale: 0.98 }} onClick={() => setActive('review')}>
            Перейти к проверке <ChevronRight size={16} />
          </motion.button>
        </RevealCard>
      </div>
    </>
  );
}
