import { motion } from 'framer-motion';
import { Clock3, Download, Plus, Trash2, X } from 'lucide-react';
import { modalMotion, useModalScrollLock, ModalPortal } from './modal.jsx';
import { Avatar, Metric, PremiumCard, Evidence, ChatSnippet } from './shared.jsx';
import { TrendChart, PremiumDropdown, RuleToggle } from './display.jsx';

export const employeeCardTransition = {
  layout: { type: 'spring', damping: 34, stiffness: 360 },
  opacity: { duration: 0.18 },
  scale: { duration: 0.18 }
};

export const reportCardTransition = {
  layout: { type: 'spring', damping: 34, stiffness: 360 },
  opacity: { duration: 0.18 },
  scale: { duration: 0.18 }
};

export function EmployeeFormModal({ form, setForm, onClose, onSubmit }) {
  useModalScrollLock();

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };
  const canSubmit = form.name.trim().length > 0;

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop employee-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="modal-shell modal-shell--small employee-modal"
        role="dialog"
        aria-modal="true"
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        exit={modalMotion.exit}
        transition={modalMotion.transition}
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
            <input value={form.name} onChange={updateField('name')} placeholder="Например, София Орлова" autoFocus />
          </label>
        </div>
        <div className="modal-actions">
          <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
            Отмена
          </motion.button>
          <motion.button className="primary-button" type="submit" whileTap={{ scale: canSubmit ? 0.97 : 1 }} disabled={!canSubmit}>
            <Plus size={17} />
            Добавить сотрудника
          </motion.button>
        </div>
      </motion.form>
      </motion.div>
    </ModalPortal>
  );
}

export function DeleteEmployeeModal({ employee, onCancel, onConfirm }) {
  useModalScrollLock();

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop employee-modal-backdrop subtle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="modal-shell modal-shell--small delete-modal"
        role="dialog"
        aria-modal="true"
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        exit={modalMotion.exit}
        transition={modalMotion.transition}
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
    </ModalPortal>
  );
}

export function EmployeeDrawer({ employee, onClose, onNewReview }) {
  useModalScrollLock();

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.aside
        layoutId={`employee-${employee.id}`}
        className="modal-shell modal-shell--large drawer"
        role="dialog"
        aria-modal="true"
        transition={employeeCardTransition}
      >
        <motion.div
          className="drawer-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
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
        </motion.div>
      </motion.aside>
      </motion.div>
    </ModalPortal>
  );
}

export function ReportDetailModal({ report, onClose }) {
  useModalScrollLock();

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop report-detail-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.aside
        layoutId={`report-${report.id}`}
        className="modal-shell modal-shell--large report-detail"
        role="dialog"
        aria-modal="true"
        transition={reportCardTransition}
      >
        <motion.div
          className="report-detail-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
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
        </motion.div>
      </motion.aside>
      </motion.div>
    </ModalPortal>
  );
}

export function RuleModal({ mode, rule, setRule, onClose, onSubmit }) {
  useModalScrollLock();

  const updateField = (field) => (value) => {
    setRule((current) => ({ ...current, [field]: value }));
  };

  const updateInput = (field) => (event) => {
    updateField(field)(event.target.value);
  };

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop rule-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="modal-shell modal-shell--medium rule-modal"
        role="dialog"
        aria-modal="true"
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        exit={modalMotion.exit}
        transition={modalMotion.transition}
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
    </ModalPortal>
  );
}

export function DeleteRuleModal({ rule, onCancel, onConfirm }) {
  useModalScrollLock();

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop rule-modal-backdrop subtle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="modal-shell modal-shell--small delete-modal"
        role="dialog"
        aria-modal="true"
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        exit={modalMotion.exit}
        transition={modalMotion.transition}
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
    </ModalPortal>
  );
}
