import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  FileText,
  FolderUp,
  Pencil,
  Play,
  Plus,
  Settings2,
  Trash2
} from 'lucide-react';
import {
  AnimatePresence,
  LayoutGroup,
  motion
} from 'framer-motion';
import './styles.css';
import { employees, demoReports, initialRules } from './data/demoData.js';
import { PremiumCard, AnimatedProgress, Avatar } from './components/shared.jsx';
import { tabs, Sidebar, Topbar } from './components/layout.jsx';
import { AnalysisState, RuleToggle, PremiumDropdown } from './components/display.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Employees } from './pages/Employees.jsx';
import { reportCardTransition, EmployeeDrawer, ReportDetailModal, RuleModal, DeleteRuleModal } from './components/modals.jsx';

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
            layoutId={`report-${report.id}`}
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
            transition={reportCardTransition}
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

function Rules() {
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

createRoot(document.getElementById('root')).render(<App />);
