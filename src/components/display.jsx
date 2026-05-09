import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { qualityPoints, mistakes } from '../data/demoData.js';
import { AnimatedProgress } from './shared.jsx';

export function KpiCard({ label, value, delta, icon: Icon }) {
  return (
    <motion.div className="kpi-card" whileHover={{ y: -5, boxShadow: '0 22px 60px rgba(92, 82, 143, 0.13)' }}>
      <div className="kpi-icon"><Icon size={20} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{delta}</small>
    </motion.div>
  );
}

export function TrendChart({ compact = false, data }) {
  const rawPoints = data ?? qualityPoints;
  const points = useMemo(
    () => rawPoints.map((value, index) => `${(index / (rawPoints.length - 1)) * 100},${100 - value}`).join(' '),
    [rawPoints]
  );
  return (
    <div className={`trend ${compact ? 'compact-trend' : ''}`}>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8d7cf6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8d7cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.polyline points={points} fill="none" stroke="#7765e3" strokeWidth="2.4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <polygon points={`0,36 ${points} 100,36`} fill="url(#trendFill)" />
      </svg>
      {!compact && <div className="chart-labels"><span>Март</span><span>Апрель</span><span>Май</span></div>}
    </div>
  );
}

export function ErrorBars() {
  return (
    <div className="error-bars">
      {mistakes.map((item, index) => (
        <div className="bar-row" key={item.label}>
          <div><span>{item.label}</span><b>{item.value}</b></div>
          <div className="bar-track">
            <motion.span initial={{ width: 0 }} animate={{ width: `${item.value * 2}%` }} transition={{ delay: index * 0.12, duration: 0.7 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const STAGE_LABEL = {
  preparing: 'Подготовка данных...',
  reading_dialogues: 'Чтение диалогов...',
  loading_rules: 'Загрузка правил...',
  contacting_ai: 'AI-анализ...',
  saving_report: 'Сохранение отчёта...',
  completed: 'Отчёт готов',
  failed: 'Ошибка анализа',
};

export function AnalysisState({ status, stage }) {
  const progress = status === 'complete' ? 100 : status === 'running' ? 72 : status === 'error' ? 0 : 8;
  const message = status === 'complete'
    ? 'Анализ завершён. Отчёт сохранён в разделе Отчёты.'
    : status === 'running'
      ? 'Анализируем диалоги: SLA, тональность, обязательные действия и критичные ошибки.'
      : status === 'error'
        ? 'Анализ завершился с ошибкой. Проверьте детали ниже.'
        : 'Загрузите файлы диалогов и нажмите «Начать анализ».';

  return (
    <div className="analysis-state">
      <div className="analysis-orb"><Sparkles size={22} /></div>
      <AnimatedProgress value={progress} />
      <p>{message}</p>
      {stage && <p style={{ fontSize: '0.78rem', opacity: 0.5, marginTop: -4, marginBottom: 4 }}>{STAGE_LABEL[stage] ?? stage}</p>}
      <div className="skeleton-stack">
        {[1, 2, 3].map((item) => (
          <motion.span
            key={item}
            className={`skeleton ${status === 'complete' ? 'complete' : ''}`}
            animate={status === 'running' ? { opacity: [0.35, 0.9, 0.35] } : {}}
            transition={{ repeat: status === 'running' ? Infinity : 0, duration: 1.4, delay: item * 0.16 }}
          />
        ))}
      </div>
    </div>
  );
}

export function RuleToggle({ active, onClick }) {
  return (
    <button className={`rule-toggle ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <span>{active ? 'Активно' : 'Выключено'}</span>
      <motion.i layout transition={{ type: 'spring', damping: 18, stiffness: 260 }} />
    </button>
  );
}

export function PremiumDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="premium-select">
      <motion.button
        type="button"
        className={`premium-select-trigger ${open ? 'open' : ''}`}
        whileTap={{ scale: 0.985 }}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={17} />
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="premium-select-menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 8, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {options.map((option) => (
              <motion.button
                type="button"
                className={`premium-select-option ${option === value ? 'selected' : ''}`}
                key={option}
                whileHover={{ x: 3 }}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span>{option}</span>
                {option === value && <Check size={16} />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
