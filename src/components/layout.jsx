import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound
} from 'lucide-react';
import { motion } from 'framer-motion';

export const tabs = [
  { id: 'dashboard', label: 'Главная', icon: LayoutDashboard },
  { id: 'employees', label: 'Сотрудники', icon: UsersRound },
  { id: 'review', label: 'Проверка', icon: ClipboardCheck },
  { id: 'report', label: 'Отчёт', icon: FileText },
  { id: 'rules', label: 'Правила', icon: Settings2 }
];

export function Sidebar({ active, setActive }) {
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
          <div className="mvp-status-row"><span><i className="dot demo" />AI-анализ</span><b>демо</b></div>
          <div className="mvp-status-row"><span><i className="dot ready" />Загрузка файлов</span><b>интерфейс готов</b></div>
          <div className="mvp-status-row"><span><i className="dot off" />База данных</span><b>не подключена</b></div>
          <div className="mvp-status-row"><span><i className="dot off" />API</span><b>не подключено</b></div>
          <div className="mvp-status-row"><span><i className="dot demo" />PDF-экспорт</span><b>демо</b></div>
        </div>
      </motion.div>
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
