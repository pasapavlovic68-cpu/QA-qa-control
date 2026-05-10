import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
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
      <motion.div className="modal-backdrop employee-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        className="modal-shell modal-shell--small employee-modal"
        onClick={(e) => e.stopPropagation()}
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
      <motion.div className="modal-backdrop employee-modal-backdrop subtle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div
        className="modal-shell modal-shell--small delete-modal"
        role="dialog"
        aria-modal="true"
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        exit={modalMotion.exit}
        transition={modalMotion.transition}
        onClick={(e) => e.stopPropagation()}
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

export function EmployeeDrawer({ employee, organizationId, onClose, onNewReview }) {
  useModalScrollLock();

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!employee?.id || !organizationId) {
      setHistoryLoading(false);
      return;
    }
    console.log(`[PostAnalysisDataFlow] EmployeeDrawer: fetching reports for employee=${employee.id}`);
    setHistoryLoading(true);
    Promise.all([
      supabase
        .from('reports')
        .select('id, check_id, score, title, mistakes, recommendations, created_at')
        .eq('employee_id', employee.id)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('qa_checks')
        .select('id, dialogues_count')
        .eq('employee_id', employee.id)
        .eq('organization_id', organizationId)
        .eq('status', 'complete')
    ]).then(([reportsRes, checksRes]) => {
      if (reportsRes.error) {
        console.error('[PostAnalysisDataFlow] EmployeeDrawer: reports fetch error:', reportsRes.error);
        setHistoryLoading(false);
        return;
      }
      const checkMap = {};
      (checksRes.data ?? []).forEach((c) => { checkMap[c.id] = c.dialogues_count ?? 0; });

      const rows = (reportsRes.data ?? []).map((r) => ({
        id: r.id,
        title: r.title || 'Отчёт',
        score: r.score ?? 0,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString('ru-RU') : '',
        mistakes: Array.isArray(r.mistakes) ? r.mistakes : [],
        recommendations: Array.isArray(r.recommendations) ? r.recommendations : [],
        dialogues: checkMap[r.check_id] ?? 0,
      }));
      console.log(`[PostAnalysisDataFlow] EmployeeDrawer: loaded ${rows.length} reports for employee=${employee.id}`);
      setHistory(rows);
      setHistoryLoading(false);
    });
  }, [employee?.id, organizationId]);

  // Derive display data from history
  const latestRecs = history[0]?.recommendations ?? [];
  const allMistakes = history.flatMap((r) => r.mistakes);
  const mistakeCounts = {};
  allMistakes.forEach((m) => {
    const key = m.title || m.description || '';
    if (key) mistakeCounts[key] = (mistakeCounts[key] || 0) + 1;
  });
  const topMistakes = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        layoutId={`employee-${employee.id}`}
        onClick={(e) => e.stopPropagation()}
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
            <PremiumCard title="Частые ошибки" compact>
              {historyLoading ? (
                <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '12px 0' }}>Загружаем…</p>
              ) : topMistakes.length > 0 ? (
                <div className="tag-cloud" style={{ paddingTop: 8 }}>
                  {topMistakes.map(([title, count]) => (
                    <span key={title}>{title} ×{count}</span>
                  ))}
                </div>
              ) : (
                <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '12px 0' }}>Ошибок не выявлено.</p>
              )}
            </PremiumCard>
          </motion.div>
          <motion.div variants={modalSectionVariants}>
            <PremiumCard title="Рекомендации" compact>
              {historyLoading ? (
                <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '12px 0' }}>Загружаем…</p>
              ) : latestRecs.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem', lineHeight: 1.6 }}>
                  {latestRecs.slice(0, 3).map((rec, i) => (
                    <li key={i}>{rec.text || rec.description || rec.title || rec}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '12px 0' }}>Рекомендации появятся после первого отчёта.</p>
              )}
            </PremiumCard>
          </motion.div>
          <motion.div className="history" variants={modalSectionVariants}>
            <h3>История проверок</h3>
            {historyLoading ? (
              <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '8px 0' }}>Загружаем историю…</p>
            ) : history.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {history.map((r) => (
                  <div key={r.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: 'rgba(119,101,227,0.06)',
                    border: '1px solid rgba(119,101,227,0.10)',
                    fontSize: '0.85rem',
                  }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>{r.title}</span>
                    <span style={{ color: 'var(--muted)', marginRight: 12 }}>{r.date}</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{r.score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ opacity: 0.4, fontSize: '0.875rem', padding: '8px 0' }}>История проверок пока пуста.</p>
            )}
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
      <motion.div className="modal-backdrop report-detail-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        layoutId={`report-${report.id}`}
        onClick={(e) => e.stopPropagation()}
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
      <motion.div className="modal-backdrop rule-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        className="modal-shell modal-shell--medium rule-modal"
        onClick={(e) => e.stopPropagation()}
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
      <motion.div className="modal-backdrop rule-modal-backdrop subtle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div
        className="modal-shell modal-shell--small delete-modal"
        role="dialog"
        aria-modal="true"
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        exit={modalMotion.exit}
        transition={modalMotion.transition}
        onClick={(e) => e.stopPropagation()}
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
