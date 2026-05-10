import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase.js';

export const tabs = [
  { id: 'dashboard', label: 'Главная', icon: LayoutDashboard },
  { id: 'employees', label: 'Сотрудники', icon: UsersRound },
  { id: 'review', label: 'Проверка', icon: ClipboardCheck },
  { id: 'report', label: 'Отчёт', icon: FileText },
  { id: 'rules', label: 'Правила', icon: Settings2 },
  { id: 'settings', label: 'Настройки', icon: SlidersHorizontal }
];

const STATUS_LABEL = {
  checking: 'проверка…',
  connected: 'подключена',
  active: 'активен',
  beta: 'бета',
  degraded: 'сбой',
  offline: 'недоступна',
  not_implemented: 'в разработке',
};

const STATUS_DOT = {
  checking: 'demo',
  connected: 'ready',
  active: 'ready',
  beta: 'demo',
  not_implemented: 'demo',
  degraded: 'warn',
  offline: 'warn',
};

function analysisToStatus(analysis) {
  if (analysis === 'complete' || analysis === 'running') return 'active';
  if (analysis === 'error') return 'degraded';
  return 'beta';
}

export function Sidebar({ active, setActive, systemStatus = {} }) {
  return (
    <aside className="sidebar">
      <motion.div className="brand" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="brand-mark"><ShieldCheck size={22} /></div>
        <div>
          <strong>QA Control</strong>
          <span>Контроль качества диалогов</span>
        </div>
      </motion.div>
      <nav className="nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={`nav-item ${active === tab.id ? 'active' : ''}`} onClick={() => setActive(tab.id)}>
              {active === tab.id && <motion.span layoutId="active-tab" className="nav-indicator" />}
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <motion.div className="ai-card" whileHover={{ y: -4, scale: 1.01 }}>
        <div className="mvp-card-title">
          <Sparkles size={18} />
          <strong>Статус MVP</strong>
        </div>
        <div className="mvp-status-list">
          {[
            { label: 'AI-анализ', value: analysisToStatus(systemStatus.analysis) },
            { label: 'Загрузка файлов', value: systemStatus.upload ?? 'beta' },
            { label: 'База данных', value: systemStatus.supabase ?? 'checking' },
            { label: 'API', value: systemStatus.supabase === 'connected' ? 'connected' : systemStatus.supabase === 'offline' ? 'offline' : 'checking' },
            { label: 'PDF-экспорт', value: systemStatus.pdf ?? 'not_implemented' },
          ].map(({ label, value }) => (
            <div className="mvp-status-row" key={label}>
              <span><i className={`dot ${STATUS_DOT[value] ?? 'demo'}`} />{label}</span>
              <b>{STATUS_LABEL[value] ?? value}</b>
            </div>
          ))}
        </div>
      </motion.div>
      <motion.button
        className="ghost-button"
        style={{ width: '100%', marginTop: 12, color: 'var(--muted)', fontSize: 13 }}
        whileHover={{ y: -2, color: 'var(--danger)' }}
        whileTap={{ scale: 0.97 }}
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut size={15} />
        Выйти
      </motion.button>
    </aside>
  );
}

export function Topbar({ title, onNewReview }) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">Внутренний QA-контур</span>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <label className="search">
          <Search size={17} />
          <input placeholder="Поиск сотрудника или проверки" />
        </label>
        <motion.button className="primary-button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={onNewReview}>
          <Sparkles size={17} />
          Новая проверка
        </motion.button>
      </div>
    </header>
  );
}
