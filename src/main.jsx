import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  FolderUp,
  LayoutDashboard,
  MessageSquareText,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
  X
} from 'lucide-react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useInView
} from 'framer-motion';
import './styles.css';

const tabs = [
  { id: 'dashboard', label: 'Главная', icon: LayoutDashboard },
  { id: 'employees', label: 'Сотрудники', icon: UsersRound },
  { id: 'review', label: 'Проверка', icon: ClipboardCheck },
  { id: 'report', label: 'Отчёт', icon: FileText },
  { id: 'rules', label: 'Правила', icon: Settings2 }
];

const employees = [
  { id: 1, name: 'Анна Романова', role: 'Старший оператор поддержки', score: 94, dialogs: 184, issue: 'Иногда не фиксирует итог обращения', status: 'Улучшается', statusTone: 'success', trend: '+6%' },
  { id: 2, name: 'Илья Сафонов', role: 'Специалист первой линии', score: 87, dialogs: 143, issue: 'Недостаточно уточняющих вопросов', status: 'Без изменений', statusTone: 'neutral', trend: '0%' },
  { id: 3, name: 'Мария Левина', role: 'Оператор чата продаж', score: 78, dialogs: 119, issue: 'Пропуск обязательного шага в CRM', status: 'На контроле', statusTone: 'warning', trend: '-3%' },
  { id: 4, name: 'Дмитрий Волков', role: 'Младший оператор', score: 61, dialogs: 96, issue: 'Резкие формулировки и шаблонные ответы', status: 'Критично', statusTone: 'danger', trend: '-11%' },
  { id: 5, name: 'Екатерина Белова', role: 'Специалист удержания', score: 91, dialogs: 132, issue: 'Редко предлагает альтернативные решения', status: 'Улучшается', statusTone: 'success', trend: '+4%' },
  { id: 6, name: 'Павел Миронов', role: 'Оператор B2B линии', score: 83, dialogs: 101, issue: 'Долго подтверждает детали заявки', status: 'Без изменений', statusTone: 'neutral', trend: '+1%' }
];

const checks = [
  'Диалог #QC-1842: корректность закрытия обращения',
  'Диалог #QC-1839: тональность ответа по возврату',
  'Диалог #QC-1834: соблюдение SLA в вечернюю смену',
  'Диалог #QC-1828: полнота фиксации причины отказа'
];

const mistakes = [
  { label: 'Нет финального резюме для клиента', value: 38 },
  { label: 'Не задан уточняющий вопрос', value: 31 },
  { label: 'Слишком поздний ответ', value: 24 },
  { label: 'Некорректная фраза завершения', value: 18 }
];

const qualityPoints = [72, 76, 74, 81, 84, 83, 88, 91];

const demoReports = [
  {
    id: 'QC-1842',
    employee: 'Анна Романова',
    date: '08 мая 2026',
    dialogs: 42,
    score: 86,
    critical: 1,
    status: 'Хорошо',
    tone: 'good',
    summary: 'Стабильная коммуникация, требуется точнее фиксировать итог обращения.',
    management: 'Сотрудник корректно удержал тон общения и предложил клиенту рабочее решение. Для повышения оценки нужно фиксировать итог обращения в CRM и завершать диалог конкретным следующим шагом.'
  },
  {
    id: 'QC-1839',
    employee: 'Мария Левина',
    date: '07 мая 2026',
    dialogs: 36,
    score: 74,
    critical: 3,
    status: 'Есть ошибки',
    tone: 'warning',
    summary: 'Есть повторяющиеся пропуски обязательных действий и слабая детализация ответов.',
    management: 'Диалоги требуют внимания наставника: клиентам часто не хватает точного следующего шага, а часть обращений закрыта без полного заполнения карточки.'
  },
  {
    id: 'QC-1834',
    employee: 'Дмитрий Волков',
    date: '06 мая 2026',
    dialogs: 28,
    score: 58,
    critical: 7,
    status: 'Критично',
    tone: 'danger',
    summary: 'Высокая доля резких формулировок и превышений SLA во второй линии ответа.',
    management: 'Нужен индивидуальный план контроля: в проверке выявлены критичные нарушения тона, задержки ответа и отсутствие корректного финального резюме.'
  },
  {
    id: 'QC-1828',
    employee: 'Екатерина Белова',
    date: '05 мая 2026',
    dialogs: 31,
    score: 91,
    critical: 0,
    status: 'Хорошо',
    tone: 'good',
    summary: 'Сильная эмпатия и аккуратные формулировки, не хватает альтернативных предложений.',
    management: 'Проверка показывает высокий уровень качества. Рекомендовано усилить блок удержания: чаще предлагать клиенту второй вариант решения.'
  },
  {
    id: 'QC-1819',
    employee: 'Павел Миронов',
    date: '03 мая 2026',
    dialogs: 25,
    score: 79,
    critical: 2,
    status: 'Есть ошибки',
    tone: 'warning',
    summary: 'Ответы корректные, но часть B2B-заявок долго подтверждалась внутри смены.',
    management: 'Качество общения приемлемое, однако задержки подтверждения деталей снижают итоговую оценку. Требуется контроль SLA по сложным заявкам.'
  },
  {
    id: 'QC-1812',
    employee: 'Илья Сафонов',
    date: '01 мая 2026',
    dialogs: 33,
    score: 83,
    critical: 1,
    status: 'Хорошо',
    tone: 'good',
    summary: 'Ровная работа с клиентами, повторяется нехватка уточняющих вопросов.',
    management: 'Сотрудник уверенно закрывает типовые обращения. Для роста оценки нужно чаще проверять контекст клиента до передачи решения.'
  }
];

function App() {
  const [active, setActive] = useState('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [analysis, setAnalysis] = useState('idle');

  const currentTitle = tabs.find((tab) => tab.id === active)?.label ?? 'Главная';

  return (
    <LayoutGroup>
      <div className="app-shell">
        <Sidebar active={active} setActive={setActive} />
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
              {active === 'dashboard' && <Dashboard setActive={setActive} setDetailOpen={setDetailOpen} setSelectedEmployee={setSelectedEmployee} />}
              {active === 'employees' && <Employees setDetailOpen={setDetailOpen} setSelectedEmployee={setSelectedEmployee} />}
              {active === 'review' && <Review analysis={analysis} setAnalysis={setAnalysis} />}
              {active === 'report' && <Report />}
              {active === 'rules' && <Rules />}
            </motion.section>
          </AnimatePresence>
        </main>
        <AnimatePresence>
          {detailOpen && (
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

function Sidebar({ active, setActive }) {
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

function Topbar({ title, onNewReview }) {
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

function Dashboard({ setActive, setDetailOpen, setSelectedEmployee }) {
  const kpis = [
    { label: 'Проверено диалогов', value: '1 284', delta: '+18% за неделю', icon: MessageSquareText },
    { label: 'Средняя оценка качества', value: '86.4', delta: '+3.2 пункта', icon: Activity },
    { label: 'Критические ошибки', value: '27', delta: '-9 за период', icon: AlertTriangle },
    { label: 'Сотрудников на контроле', value: '14', delta: '4 требуют внимания', icon: UsersRound }
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
            {employees.slice(0, 4).map((employee, index) => (
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

function Employees({ setDetailOpen, setSelectedEmployee }) {
  const [employeeList, setEmployeeList] = useState(employees);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({
    name: '',
    role: '',
    status: 'На контроле',
    issue: ''
  });

  const statusToneByLabel = {
    'Улучшается': 'success',
    'Без изменений': 'neutral',
    'На контроле': 'warning',
    'Критично': 'danger'
  };

  const resetForm = () => {
    setForm({
      name: '',
      role: '',
      status: 'На контроле',
      issue: ''
    });
  };

  const handleAddEmployee = (event) => {
    event.preventDefault();

    const newEmployee = {
      id: Date.now(),
      name: form.name.trim() || 'Новый сотрудник',
      role: form.role.trim() || 'Оператор поддержки',
      score: 72,
      dialogs: 0,
      issue: form.issue.trim() || 'Зона контроля пока не заполнена',
      status: form.status,
      statusTone: statusToneByLabel[form.status] ?? 'neutral',
      trend: 'Новый'
    };

    setEmployeeList((current) => [newEmployee, ...current]);
    resetForm();
    setAddOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setEmployeeList((current) => current.filter((employee) => employee.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="employees-page-head">
        <div>
          <span className="eyebrow">Команда на контроле</span>
          <h2>Карточки сотрудников</h2>
        </div>
        <motion.button className="primary-button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={() => setAddOpen(true)}>
          <Plus size={17} />
          Добавить сотрудника
        </motion.button>
      </div>

      <motion.div className="employee-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
        <AnimatePresence mode="popLayout">
          {employeeList.map((employee) => (
            <motion.article
              layout
              layoutId={`employee-${employee.id}`}
              className="employee-card"
              key={employee.id}
              variants={{ hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -5, scale: 1.008 }}
              whileTap={{ scale: 0.985 }}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedEmployee(employee);
                setDetailOpen(true);
              }}
            >
              <div className="employee-head">
                <Avatar name={employee.name} />
                <div className="employee-head-actions">
                  <span className={`status ${employee.statusTone}`}>{employee.status}</span>
                  <motion.button
                    className="employee-delete"
                    aria-label={`Удалить сотрудника ${employee.name}`}
                    whileTap={{ scale: 0.9 }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(employee);
                    }}
                  >
                    <Trash2 size={15} />
                  </motion.button>
                </div>
              </div>
              <h3>{employee.name}</h3>
              <p>{employee.role}</p>
              <div className="score-line">
                <strong>{employee.score}</strong>
                <AnimatedProgress value={employee.score} />
              </div>
              <div className="employee-meta">
                <span>{employee.dialogs} диалогов</span>
                <span>{employee.trend}</span>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {addOpen && (
          <EmployeeFormModal
            form={form}
            setForm={setForm}
            onClose={() => {
              resetForm();
              setAddOpen(false);
            }}
            onSubmit={handleAddEmployee}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteEmployeeModal
            employee={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function EmployeeFormModal({ form, setForm, onClose, onSubmit }) {
  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  return (
    <motion.div className="employee-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="employee-modal"
        initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(6px)' }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={onSubmit}
      >
        <div className="modal-title">
          <div>
            <span className="eyebrow">Новый профиль QA</span>
            <h2>Добавить сотрудника</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="employee-form-grid">
          <label>
            <span>Имя сотрудника</span>
            <input value={form.name} onChange={updateField('name')} placeholder="Например, София Орлова" />
          </label>
          <label>
            <span>Должность</span>
            <input value={form.role} onChange={updateField('role')} placeholder="Оператор поддержки" />
          </label>
          <label>
            <span>Статус</span>
            <select value={form.status} onChange={updateField('status')}>
              <option>Улучшается</option>
              <option>Без изменений</option>
              <option>На контроле</option>
              <option>Критично</option>
            </select>
          </label>
          <label>
            <span>Основная зона контроля</span>
            <input value={form.issue} onChange={updateField('issue')} placeholder="Например, фиксация итога обращения" />
          </label>
        </div>
        <div className="modal-actions">
          <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
            Отмена
          </motion.button>
          <motion.button className="primary-button" type="submit" whileTap={{ scale: 0.97 }}>
            <Plus size={17} />
            Добавить сотрудника
          </motion.button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function DeleteEmployeeModal({ employee, onCancel, onConfirm }) {
  return (
    <motion.div className="employee-modal-backdrop subtle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="delete-modal"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.24 }}
      >
        <div className="delete-icon"><Trash2 size={18} /></div>
        <h2>Удалить карточку?</h2>
        <p>{employee.name} будет удалён только из текущего демо-списка.</p>
        <div className="modal-actions">
          <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onCancel}>
            Отмена
          </motion.button>
          <motion.button className="soft-danger-button" type="button" whileTap={{ scale: 0.97 }} onClick={onConfirm}>
            Удалить
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EmployeeDrawer({ employee, onClose, onNewReview }) {
  return (
    <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.aside
        layoutId={`employee-${employee.id}`}
        className="drawer"
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 260 }}
      >
        <button className="icon-button close" onClick={onClose}><X size={18} /></button>
        <div className="profile-header">
          <Avatar name={employee.name} large />
          <div>
            <span className={`status ${employee.statusTone}`}>{employee.status}</span>
            <h2>{employee.name}</h2>
            <p>{employee.role}</p>
          </div>
        </div>
        <div className="mini-metrics">
          <Metric label="Оценка" value={employee.score} />
          <Metric label="Проверок" value={employee.dialogs} />
          <Metric label="Тренд" value={employee.trend} />
        </div>
        <PremiumCard title="Динамика качества" compact>
          <TrendChart compact />
        </PremiumCard>
        <PremiumCard title="Частые ошибки" compact>
          <ul className="mistake-list">
            <li>Нет краткого итога после решения</li>
            <li>Слабая эмпатия в сложных обращениях</li>
            <li>Задержка ответа свыше целевого SLA</li>
          </ul>
        </PremiumCard>
        <PremiumCard title="Рекомендации" compact>
          <div className="recommendations">
            <p>Использовать финальное резюме: причина, действие, следующий шаг.</p>
            <p>Добавлять один уточняющий вопрос перед передачей заявки.</p>
          </div>
        </PremiumCard>
        <div className="history">
          <h3>История проверок</h3>
          {['Сегодня, 12:40', 'Вчера, 17:15', '05 мая, 10:20'].map((date) => (
            <div className="history-row" key={date}>
              <Clock3 size={16} />
              <span>{date}</span>
              <b>Отчёт готов</b>
            </div>
          ))}
        </div>
        <motion.button className="primary-button full glow" whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }} onClick={onNewReview}>
          Новая проверка
        </motion.button>
      </motion.aside>
    </motion.div>
  );
}

function Review({ analysis, setAnalysis }) {
  const [selectedEmployeeName, setSelectedEmployeeName] = useState(employees[0].name);
  const [selectedPreset, setSelectedPreset] = useState('Стандарт поддержки');

  useEffect(() => {
    if (analysis !== 'running') return undefined;

    const timer = window.setTimeout(() => {
      setAnalysis('complete');
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [analysis, setAnalysis]);

  const startAnalysis = () => {
    setAnalysis('running');
  };

  return (
    <div className="review-layout">
      <PremiumCard className="review-main" title="Новая проверка диалогов" action="Демо-режим">
        <div className="form-row">
          <label>
            <span>Сотрудник</span>
            <PremiumDropdown
              value={selectedEmployeeName}
              options={employees.map((employee) => employee.name)}
              onChange={setSelectedEmployeeName}
            />
          </label>
          <label>
            <span>Набор правил QA</span>
            <PremiumDropdown
              value={selectedPreset}
              options={['Стандарт поддержки', 'Продажи и удержание', 'B2B сопровождение']}
              onChange={setSelectedPreset}
            />
          </label>
        </div>
        <motion.div className="upload-zone" tabIndex={0} whileHover={{ scale: 1.006, borderColor: '#8d7cf6' }} whileFocus={{ scale: 1.006, borderColor: '#8d7cf6' }}>
          <FolderUp size={30} />
          <strong>Перетащите файлы диалогов сюда</strong>
          <span>CSV, XLSX, TXT. Только визуальная зона, без загрузки и парсинга.</span>
        </motion.div>
        <div className="file-list">
          {['dialogs_april_shift_a.csv', 'chat_export_romanova_184.xlsx', 'support_cases_sample.txt'].map((file, index) => (
            <div className="file-row" key={file}>
              <FileText size={16} />
              <span>{file}</span>
              <b>{index === 0 ? 'Готов' : 'В очереди'}</b>
            </div>
          ))}
        </div>
        <motion.button className="primary-button large glow" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={startAnalysis}>
          <Play size={18} />
          {analysis === 'running' ? 'Анализ выполняется' : 'Начать анализ'}
        </motion.button>
      </PremiumCard>
      <PremiumCard title="Состояние анализа" action={analysis === 'complete' ? 'Готово' : analysis === 'running' ? 'Выполняется' : 'Ожидает запуска'}>
        <AnalysisState status={analysis} />
      </PremiumCard>
    </div>
  );
}

function PremiumDropdown({ value, options, onChange }) {
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

function Report() {
  const [selectedReport, setSelectedReport] = useState(null);
  const [query, setQuery] = useState('');

  const filteredReports = demoReports.filter((report) => {
    const searchValue = `${report.id} ${report.employee} ${report.status} ${report.summary}`.toLowerCase();
    return searchValue.includes(query.toLowerCase());
  });

  return (
    <>
      <div className="reports-head">
        <div>
          <span className="eyebrow">История проверок</span>
          <h2>Сформированные отчёты</h2>
        </div>
        <label className="report-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти отчёт, сотрудника или статус" />
        </label>
      </div>

      <motion.div className="reports-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
        {filteredReports.map((report) => (
          <motion.button
            className="report-card"
            key={report.id}
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.36 }}
            whileHover={{ y: -5, scale: 1.008 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => setSelectedReport(report)}
          >
            <div className="report-card-top">
              <span className="report-number">Отчёт #{report.id}</span>
              <span className={`report-status ${report.tone}`}>{report.status}</span>
            </div>
            <div className="report-person">
              <Avatar name={report.employee} />
              <div>
                <h3>{report.employee}</h3>
                <p>{report.date}</p>
              </div>
            </div>
            <p className="report-summary">{report.summary}</p>
            <div className="report-metrics">
              <span><b>{report.dialogs}</b> диалогов</span>
              <span><b>{report.score}</b> оценка</span>
              <span><b>{report.critical}</b> критич.</span>
            </div>
            <div className="report-score-line">
              <AnimatedProgress value={report.score} />
            </div>
          </motion.button>
        ))}
      </motion.div>

      <AnimatePresence>
        {selectedReport && (
          <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

function ReportDetailModal({ report, onClose }) {
  return (
    <motion.div className="report-detail-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.aside
        className="report-detail"
        initial={{ opacity: 0, y: 26, scale: 0.96, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(6px)' }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="report-detail-header">
          <div>
            <span className="eyebrow">Отчёт #{report.id}</span>
            <h2>{report.employee}</h2>
            <p>{report.date} · {report.dialogs} проверенных диалогов</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="report-layout detail-layout">
          <PremiumCard className="score-card" title="Итоговая оценка" action={report.status}>
            <motion.div className="score-orb" initial={{ scale: 0.86 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 220 }}>
              {report.score}
            </motion.div>
            <p>{report.summary}</p>
            <motion.button className="primary-button full" whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }}>
              <Download size={17} />
              Экспорт отчёта
            </motion.button>
          </PremiumCard>
          <PremiumCard className="wide" title="Резюме для руководителя">
            <p className="management-text">{report.management}</p>
            <div className="report-columns">
              <Evidence title="Ошибка" tone="danger" text="Оператор не подтвердил, что клиенту понятно дальнейшее действие." />
              <Evidence title="Положительный момент" tone="success" text="В сложном моменте сотрудник сохранил спокойный тон и предложил альтернативу." />
            </div>
          </PremiumCard>
          <PremiumCard title="Ошибки">
            <div className="tag-cloud">
              <span>Нет финального резюме</span>
              <span>Превышение SLA</span>
              <span>Не заполнено поле CRM</span>
              <span>Слабое уточнение</span>
            </div>
          </PremiumCard>
          <PremiumCard title="Визуальные доказательства">
            <ChatSnippet role="Клиент" text="Я уже третий раз уточняю статус заявки. Когда будет ответ?" />
            <ChatSnippet role="Оператор" text="Понимаю ситуацию. Проверю статус и вернусь с точным временем решения." good />
          </PremiumCard>
        </div>

        <motion.button className="ghost-button full report-back-button" whileTap={{ scale: 0.98 }} onClick={onClose}>
          Назад к отчётам
        </motion.button>
      </motion.aside>
    </motion.div>
  );
}

function Rules() {
  const initialRules = [
    { id: 1, title: 'Порог времени ответа', category: 'SLA', description: 'Первый ответ до 45 секунд, повторный ответ до 3 минут.', weight: 'Высокая', active: true },
    { id: 2, title: 'Запрещённые фразы', category: 'Тон общения', description: 'Контроль фраз: «это не наша проблема», «читайте инструкцию», «я не знаю».', weight: 'Критичная', active: true },
    { id: 3, title: 'Обязательные действия оператора', category: 'Процесс', description: 'Уточнить контекст, зафиксировать итог обращения, указать следующий шаг.', weight: 'Высокая', active: true },
    { id: 4, title: 'Вес ошибок', category: 'Скоринг', description: 'Критичная ошибка -20, существенная -10, лёгкая -4 к итоговой оценке.', weight: 'Средняя', active: true },
    { id: 5, title: 'Шаблон отчёта для наставника', category: 'Отчёты', description: 'Фокус на повторяющихся ошибках, рекомендациях и плане улучшения.', weight: 'Низкая', active: false }
  ];

  const emptyRule = {
    title: '',
    category: 'Процесс',
    description: '',
    weight: 'Средняя',
    active: true
  };

  const [rules, setRules] = useState(initialRules);
  const [modalMode, setModalMode] = useState(null);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAddModal = () => {
    setRuleForm(emptyRule);
    setModalMode('add');
  };

  const openEditModal = (rule) => {
    setRuleForm(rule);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setRuleForm(emptyRule);
  };

  const saveRule = (event) => {
    event.preventDefault();

    if (modalMode === 'edit') {
      setRules((current) => current.map((rule) => (
        rule.id === ruleForm.id ? { ...ruleForm, title: ruleForm.title.trim() || 'Новое правило' } : rule
      )));
    } else {
      setRules((current) => [
        {
          ...ruleForm,
          id: Date.now(),
          title: ruleForm.title.trim() || 'Новое правило',
          description: ruleForm.description.trim() || 'Описание правила пока не заполнено.'
        },
        ...current
      ]);
    }

    closeModal();
  };

  const toggleRule = (ruleId) => {
    setRules((current) => current.map((rule) => (
      rule.id === ruleId ? { ...rule, active: !rule.active } : rule
    )));
  };

  const confirmDeleteRule = () => {
    if (!deleteTarget) return;
    setRules((current) => current.filter((rule) => rule.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="rules-head">
        <div>
          <span className="eyebrow">Конфигурация QA</span>
          <h2>Правила проверки</h2>
        </div>
        <motion.button className="primary-button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={openAddModal}>
          <Plus size={17} />
          Добавить правило
        </motion.button>
      </div>

      <motion.div className="rules-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.065 } } }}>
        <AnimatePresence mode="popLayout">
          {rules.map((rule) => (
            <motion.article
              layout
              className="rule-card"
              key={rule.id}
              variants={{ hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -5, scale: 1.008 }}
            >
              <div className="rule-card-top">
                <div className="rule-icon"><Settings2 size={18} /></div>
                <div className="rule-actions">
                  <motion.button className="rule-action" aria-label={`Редактировать ${rule.title}`} whileTap={{ scale: 0.9 }} onClick={() => openEditModal(rule)}>
                    <Pencil size={15} />
                  </motion.button>
                  <motion.button className="rule-action danger" aria-label={`Удалить ${rule.title}`} whileTap={{ scale: 0.9 }} onClick={() => setDeleteTarget(rule)}>
                    <Trash2 size={15} />
                  </motion.button>
                </div>
              </div>
              <div className="rule-title-row">
                <h3>{rule.title}</h3>
                <span className={`rule-status ${rule.active ? 'active' : 'disabled'}`}>{rule.active ? 'Активно' : 'Выключено'}</span>
              </div>
              <p>{rule.description}</p>
              <div className="rule-meta">
                <span>{rule.category}</span>
                <b>{rule.weight}</b>
              </div>
              <RuleToggle active={rule.active} onClick={() => toggleRule(rule.id)} />
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {modalMode && (
          <RuleModal
            mode={modalMode}
            rule={ruleForm}
            setRule={setRuleForm}
            onClose={closeModal}
            onSubmit={saveRule}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteRuleModal
            rule={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDeleteRule}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function RuleToggle({ active, onClick }) {
  return (
    <button className={`rule-toggle ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <span>{active ? 'Активно' : 'Выключено'}</span>
      <motion.i layout transition={{ type: 'spring', damping: 18, stiffness: 260 }} />
    </button>
  );
}

function RuleModal({ mode, rule, setRule, onClose, onSubmit }) {
  const updateField = (field) => (value) => {
    setRule((current) => ({ ...current, [field]: value }));
  };

  const updateInput = (field) => (event) => {
    updateField(field)(event.target.value);
  };

  return (
    <motion.div className="rule-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="rule-modal"
        initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(6px)' }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={onSubmit}
      >
        <div className="modal-title">
          <div>
            <span className="eyebrow">{mode === 'edit' ? 'Редактирование правила' : 'Новое правило QA'}</span>
            <h2>{mode === 'edit' ? 'Изменить правило' : 'Добавить правило'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="rule-form-grid">
          <label>
            <span>Название правила</span>
            <input value={rule.title} onChange={updateInput('title')} placeholder="Например, Финальное резюме обращения" />
          </label>
          <label>
            <span>Категория</span>
            <PremiumDropdown value={rule.category} options={['SLA', 'Тон общения', 'Процесс', 'Скоринг', 'Отчёты']} onChange={updateField('category')} />
          </label>
          <label className="rule-form-wide">
            <span>Описание</span>
            <textarea value={rule.description} onChange={updateInput('description')} placeholder="Коротко опишите, что должно проверяться в диалоге" />
          </label>
          <label>
            <span>Вес ошибки / важность</span>
            <PremiumDropdown value={rule.weight} options={['Критичная', 'Высокая', 'Средняя', 'Низкая']} onChange={updateField('weight')} />
          </label>
          <label>
            <span>Статус</span>
            <RuleToggle active={rule.active} onClick={() => updateField('active')(!rule.active)} />
          </label>
        </div>
        <div className="modal-actions">
          <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
            Отмена
          </motion.button>
          <motion.button className="primary-button" type="submit" whileTap={{ scale: 0.97 }}>
            {mode === 'edit' ? 'Сохранить правило' : 'Добавить правило'}
          </motion.button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function DeleteRuleModal({ rule, onCancel, onConfirm }) {
  return (
    <motion.div className="rule-modal-backdrop subtle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="delete-modal"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.24 }}
      >
        <div className="delete-icon"><Trash2 size={18} /></div>
        <h2>Удалить правило?</h2>
        <p>Правило «{rule.title}» будет удалено только из текущего демо-списка.</p>
        <div className="modal-actions">
          <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onCancel}>
            Отмена
          </motion.button>
          <motion.button className="soft-danger-button" type="button" whileTap={{ scale: 0.97 }} onClick={onConfirm}>
            Удалить
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function KpiCard({ label, value, delta, icon: Icon }) {
  return (
    <motion.div className="kpi-card" whileHover={{ y: -5, boxShadow: '0 22px 60px rgba(92, 82, 143, 0.13)' }}>
      <div className="kpi-icon"><Icon size={20} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{delta}</small>
    </motion.div>
  );
}

function PremiumCard({ title, action, children, className = '', compact = false }) {
  return (
    <motion.article className={`premium-card ${compact ? 'compact' : ''} ${className}`} whileHover={{ y: compact ? 0 : -3 }}>
      <div className="card-title">
        <h2>{title}</h2>
        {action && <span>{action}</span>}
      </div>
      {children}
    </motion.article>
  );
}

function RevealCard(props) {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.45 }}>
      <PremiumCard {...props} />
    </motion.div>
  );
}

function Stagger({ children, className }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.075 } } }}>
      {React.Children.map(children, (child) => (
        <motion.div variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

function TrendChart({ compact = false }) {
  const points = useMemo(() => qualityPoints.map((value, index) => `${(index / (qualityPoints.length - 1)) * 100},${100 - value}`).join(' '), []);
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

function ErrorBars() {
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

function AnimatedProgress({ value }) {
  return (
    <div className="progress">
      <motion.span initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
    </div>
  );
}

function AnalysisState({ status }) {
  const progress = status === 'complete' ? 100 : status === 'running' ? 72 : 8;
  const message = status === 'complete'
    ? 'Демо-анализ завершён. Результаты готовы для будущего отчёта.'
    : status === 'running'
      ? 'Анализируем диалоги: SLA, тональность, обязательные действия и критичные ошибки.'
      : 'Запустите проверку, чтобы увидеть будущий сценарий AI-анализа.';

  return (
    <div className="analysis-state">
      <div className="analysis-orb"><Sparkles size={22} /></div>
      <AnimatedProgress value={progress} />
      <p>{message}</p>
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

function Avatar({ name, large = false }) {
  return <div className={`avatar ${large ? 'large' : ''}`}>{name.split(' ').map((part) => part[0]).join('')}</div>;
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Evidence({ title, text, tone }) {
  return (
    <div className={`evidence ${tone}`}>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function ChatSnippet({ role, text, good }) {
  return (
    <div className={`chat-snippet ${good ? 'good' : ''}`}>
      <span>{role}</span>
      <p>{text}</p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
