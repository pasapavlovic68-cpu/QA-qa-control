import { motion } from 'framer-motion';
import { Plus, Trash2, X } from 'lucide-react';
import { modalMotion, modalContentVariants, modalSectionVariants, useModalScrollLock, ModalPortal } from './modal.jsx';
import { Avatar, Metric, PremiumCard, Evidence, ChatSnippet } from './shared.jsx';
import { PremiumDropdown, RuleToggle } from './display.jsx';

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

export function EmployeeFormModal({ form, setForm, saving, error, onClose, onSubmit }) {
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
        <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
          <motion.div className="modal-title" variants={modalSectionVariants}>
            <div>
              <span className="eyebrow">Новый профиль QA</span>
              <h2>Добавить сотрудника</h2>
            </div>
            <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
          </motion.div>
          <motion.div className="employee-form-grid" variants={modalSectionVariants}>
            <label>
              <span>Имя сотрудника</span>
              <input value={form.name} onChange={updateField('name')} placeholder="Например, София Орлова" autoFocus />
            </label>
          </motion.div>
          {error && (
            <motion.p
              variants={modalSectionVariants}
              style={{ fontSize: '0.82rem', color: '#e05c5c', textAlign: 'center', marginBottom: 4 }}
            >
              {error}
            </motion.p>
          )}
          <motion.div className="modal-actions" variants={modalSectionVariants}>
            <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
              Отмена
            </motion.button>
            <motion.button className="primary-button" type="submit" whileTap={{ scale: canSubmit && !saving ? 0.97 : 1 }} disabled={!canSubmit || saving}>
              <Plus size={17} />
              {saving ? 'Сохраняем…' : 'Добавить сотрудника'}
            </motion.button>
          </motion.div>
        </motion.div>
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
        <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
          <motion.div className="delete-icon" variants={modalSectionVariants}><Trash2 size={18} /></motion.div>
          <motion.h2 variants={modalSectionVariants}>Удалить карточку?</motion.h2>
          <motion.p variants={modalSectionVariants}>{employee.name} будет удалён только из текущего демо-списка.</motion.p>
          <motion.div className="modal-actions" variants={modalSectionVariants}>
            <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onCancel}>
              Отмена
            </motion.button>
            <motion.button className="soft-danger-button" type="button" whileTap={{ scale: 0.97 }} onClick={onConfirm}>
              Удалить
            </motion.button>
          </motion.div>
        </motion.div>
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
          variants={modalContentVariants}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.button className="icon-button close" variants={modalSectionVariants} onClick={onClose}><X size={18} /></motion.button>
          <motion.div className="profile-header" variants={modalSectionVariants}>
            <Avatar name={employee.name} large />
            <div>
              <span className={`status ${employee.statusTone}`}>{employee.status}</span>
              <h2>{employee.name}</h2>
              <p>{employee.role}</p>
            </div>
          </motion.div>
          <motion.div className="mini-metrics" variants={modalSectionVariants}>
            <Metric label="Оценка" value={employee.score} />
            <Metric label="Проверок" value={employee.dialogs} />
            <Metric label="Тренд" value={employee.trend} />
          </motion.div>
          <motion.div variants={modalSectionVariants}>
            <PremiumCard title="Динамика качества" compact>
              <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '12px 0' }}>Динамика появится после первых проверок.</p>
            </PremiumCard>
          </motion.div>
          <motion.div variants={modalSectionVariants}>
            <PremiumCard title="Частые ошибки" compact>
              <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '12px 0' }}>Ошибки появятся после AI-анализа диалогов.</p>
            </PremiumCard>
          </motion.div>
          <motion.div variants={modalSectionVariants}>
            <PremiumCard title="Рекомендации" compact>
              <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '12px 0' }}>Рекомендации появятся после первого отчёта.</p>
            </PremiumCard>
          </motion.div>
          <motion.div className="history" variants={modalSectionVariants}>
            <h3>История проверок</h3>
            <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '8px 0' }}>История проверок пока пуста.</p>
          </motion.div>
          <motion.button
            className="primary-button full glow"
            variants={modalSectionVariants}
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -2 }}
            onClick={onNewReview}
          >
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
          variants={modalContentVariants}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.div className="report-detail-header" variants={modalSectionVariants}>
            <div>
              <span className="eyebrow">Отчёт #{report.id}</span>
              <h2>{report.employee}</h2>
              <p>{report.date} · {report.dialogs} проверенных диалогов</p>
            </div>
            <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
          </motion.div>

          <motion.div className="report-layout detail-layout" variants={modalSectionVariants}>
            <PremiumCard className="score-card" title="Итоговая оценка" action={report.status}>
              <motion.div className="score-orb" initial={{ scale: 0.86 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 220 }}>
                {report.score}
              </motion.div>
              <p>{report.summary}</p>
            </PremiumCard>
            <PremiumCard className="wide" title="Резюме для руководителя">
              <p className="management-text">{report.management}</p>
              <div className="report-columns">
                {report.mistakes.slice(0, 1).map((m, i) => (
                  <Evidence key={i} title="Ошибка" tone="danger" text={m.description || m.title || ''} />
                ))}
                {report.positives.slice(0, 1).map((p, i) => (
                  <Evidence key={i} title="Положительный момент" tone="success" text={p.description || p.title || p.text || ''} />
                ))}
              </div>
            </PremiumCard>
            <PremiumCard title="Ошибки">
              {report.mistakes.length > 0 ? (
                <div className="tag-cloud">
                  {report.mistakes.map((m, i) => (
                    <span key={i}>{m.title || m.description || ''}</span>
                  ))}
                </div>
              ) : (
                <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Ошибок не выявлено.</p>
              )}
            </PremiumCard>
            <PremiumCard title="Визуальные доказательства">
              {report.evidence.length > 0 ? (
                report.evidence.map((e, i) => (
                  <ChatSnippet key={i} role={e.role || 'Диалог'} text={e.text || ''} good={e.good ?? false} />
                ))
              ) : (
                <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Цитаты диалогов не добавлены.</p>
              )}
            </PremiumCard>
          </motion.div>

          <motion.button
            className="ghost-button full report-back-button"
            variants={modalSectionVariants}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
          >
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
        <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
          <motion.div className="modal-title" variants={modalSectionVariants}>
            <div>
              <span className="eyebrow">{mode === 'edit' ? 'Редактирование правила' : 'Новое правило QA'}</span>
              <h2>{mode === 'edit' ? 'Изменить правило' : 'Добавить правило'}</h2>
            </div>
            <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
          </motion.div>
          <motion.div className="rule-form-grid" variants={modalSectionVariants}>
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
          </motion.div>
          <motion.div className="modal-actions" variants={modalSectionVariants}>
            <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
              Отмена
            </motion.button>
            <motion.button className="primary-button" type="submit" whileTap={{ scale: 0.97 }}>
              {mode === 'edit' ? 'Сохранить правило' : 'Добавить правило'}
            </motion.button>
          </motion.div>
        </motion.div>
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
        <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
          <motion.div className="delete-icon" variants={modalSectionVariants}><Trash2 size={18} /></motion.div>
          <motion.h2 variants={modalSectionVariants}>Удалить правило?</motion.h2>
          <motion.p variants={modalSectionVariants}>Правило «{rule.title}» будет удалено только из текущего демо-списка.</motion.p>
          <motion.div className="modal-actions" variants={modalSectionVariants}>
            <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onCancel}>
              Отмена
            </motion.button>
            <motion.button className="soft-danger-button" type="button" whileTap={{ scale: 0.97 }} onClick={onConfirm}>
              Удалить
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
      </motion.div>
    </ModalPortal>
  );
}
