import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BadgeDollarSign, Check, ChevronDown, ChevronUp, Download, Plus, Trash2, X } from 'lucide-react';
import { downloadDialoguePdf } from '../lib/generatePdf.js';
import { supabase } from '../lib/supabase.js';
import { runModalSuccessFlow } from '../lib/modalSuccess.js';
import { modalMotion, modalContentVariants, modalSectionVariants, useModalScrollLock, ModalPortal } from './modal.jsx';
import { useToast } from './Toast.jsx';
import { Avatar, Metric, PremiumCard, Evidence, ChatSnippet, CustomSelect } from './shared.jsx';
import { PremiumDropdown, RuleToggle } from './display.jsx';

const STATUS_PRESETS = [
  '#7765e3', '#4f8ef7', '#3cb87a', '#d4920a',
  '#d94f5c', '#e0703a', '#2bb5c8', '#8a8fa8',
  '#d064a8', '#2e9e8f',
];

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
              <span className="eyebrow">Новый сотрудник</span>
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

export function DeleteEmployeeModal({ employee, onCancel, onConfirm, saving = false }) {
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
            <motion.button className="soft-danger-button" type="button" whileTap={{ scale: saving ? 1 : 0.97 }} onClick={onConfirm} disabled={saving}>
              {saving ? 'Удаляем…' : 'Удалить'}
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

export function RuleModal({ mode, rule, setRule, onClose, onSubmit, saving = false }) {
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
              <span className="eyebrow">{mode === 'edit' ? 'Редактирование правила' : 'Новое правило проверки'}</span>
              <h2>{mode === 'edit' ? 'Изменить правило' : 'Добавить правило'}</h2>
            </div>
            <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
          </motion.div>
          <motion.div className="rule-form-grid" variants={modalSectionVariants}>
            <label>
              <span>Название правила</span>
              <input value={rule.title} onChange={updateInput('title')} placeholder="Например, Финальное резюме обращения" required />
            </label>
            <label>
              <span>Категория</span>
              <PremiumDropdown value={rule.category} options={['SLA', 'Тон общения', 'Процесс', 'Скоринг', 'Отчёты']} onChange={updateField('category')} />
            </label>
            <label className="rule-form-wide">
              <span>Описание</span>
              <textarea value={rule.description} onChange={updateInput('description')} placeholder="Коротко опишите, что должно проверяться в диалоге" required />
            </label>
            <label>
              <span>Вес ошибки / важность</span>
              <PremiumDropdown value={rule.weight} options={['Критичная', 'Высокая', 'Средняя', 'Низкая']} onChange={updateField('weight')} dropUp />
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
            <motion.button className="primary-button" type="submit" whileTap={{ scale: saving ? 1 : 0.97 }} disabled={saving}>
              {saving ? 'Сохраняем…' : mode === 'edit' ? 'Сохранить правило' : 'Добавить правило'}
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.form>
      </motion.div>
    </ModalPortal>
  );
}

export function DeleteRuleModal({ rule, onCancel, onConfirm, saving = false }) {
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
            <motion.button className="soft-danger-button" type="button" whileTap={{ scale: saving ? 1 : 0.97 }} onClick={onConfirm} disabled={saving}>
              {saving ? 'Удаляем…' : 'Удалить'}
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

export function ReviewReportModal({ report, onClose, layoutId }) {
  useModalScrollLock();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!report || downloading) return;
    setDownloading(true);
    try {
      await downloadDialoguePdf(report);
    } finally {
      setDownloading(false);
    }
  };

  if (!report) {
    return (
      <ModalPortal>
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="modal-shell modal-shell--medium"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            initial={modalMotion.initial}
            animate={modalMotion.animate}
            exit={modalMotion.exit}
            transition={modalMotion.transition}
          >
            <p style={{ opacity: 0.4, fontSize: '0.875rem', textAlign: 'center', padding: '32px 0' }}>
              Данные отчёта пока недоступны.
            </p>
          </motion.div>
        </motion.div>
      </ModalPortal>
    );
  }

  // Field-name fallbacks: supports both Review (employeeName/createdAt/dialogueCount/management_summary)
  // and Report page (employee/date/dialogs/summary) naming conventions.
  const employeeName = report.employeeName || report.employee || '';
  const dialogueCount = report.dialogueCount ?? report.dialogs ?? 0;
  const summaryText = report.management_summary || report.summary || '';
  const formattedDate = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : (report.date || '');

  const scoreColor =
    report.score >= 85 ? 'var(--success)' :
    report.score >= 70 ? 'var(--warning)' :
    'var(--danger)';

  const scoreLabel =
    report.score >= 85 ? 'Высокий уровень' :
    report.score >= 70 ? 'Средний уровень' :
    'Низкий уровень';

  const allMistakes = report.mistakes ?? [];
  const criticalMistakes = allMistakes.filter((m) => m.severity === 'critical' || m.severity === 'high');
  const mediumMistakes = allMistakes.filter((m) => m.severity === 'medium');
  const minorMistakes = allMistakes.filter((m) => !['critical', 'high', 'medium'].includes(m.severity));

  // violations & funnel_check: direct on report (in-memory) or packed into evidence (from DB)
  const allEvidence = report.evidence ?? [];
  const violations = report.violations?.length
    ? report.violations
    : (allEvidence.find((e) => e.type === 'violations_summary')?.items ?? []);
  const funnelCheck = report.funnel_check
    ?? (allEvidence.find((e) => e.type === 'funnel_check') ?? null);

  const hasContent = summaryText || (report.recommendations ?? []).length > 0 || allMistakes.length > 0;
  const shellMotionProps = layoutId
    ? { layoutId, transition: reportCardTransition }
    : {
        initial: modalMotion.initial,
        animate: modalMotion.animate,
        exit: modalMotion.exit,
        transition: modalMotion.transition,
      };

  return (
    <ModalPortal>
      <motion.div
        className="modal-backdrop employee-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-shell modal-shell--medium"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 64px)' }}
          {...shellMotionProps}
        >
          <motion.div
            variants={modalContentVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', flexShrink: 1 }}
          >

            {/* Header */}
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div style={{ minWidth: 0 }}>
                <span className="eyebrow">Отчёт по проверке</span>
                <h2 style={{ margin: '2px 0 0', fontSize: 20 }}>{report.title || 'Отчёт'}</h2>
                {(employeeName || formattedDate) && (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                    {[employeeName, formattedDate].filter(Boolean).join(' · ')}
                    {dialogueCount > 0 && ` · ${dialogueCount} диал.`}
                  </p>
                )}
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            {/* Score row — hidden from employee view, kept in stats/report pages */}
            {dialogueCount > 0 && (
              <motion.div variants={modalSectionVariants} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{dialogueCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>диалогов</div>
                </div>
              </motion.div>
            )}

            {/* Funnel check */}
            {funnelCheck && (
              <motion.div variants={modalSectionVariants} style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
                  Воронка продаж
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {(funnelCheck.stages_completed ?? []).map((s, i) => (
                    <span key={i} style={{ fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(34,197,94,0.10)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.20)' }}>
                      ✓ {s}
                    </span>
                  ))}
                  {(funnelCheck.stages_missed ?? []).map((s, i) => (
                    <span key={i} style={{ fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(190,60,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(190,60,68,0.18)' }}>
                      ✗ {s}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {funnelCheck.response_time_minutes != null && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 10,
                      background: funnelCheck.response_time_minutes > 10 ? 'rgba(190,60,68,0.08)' : 'rgba(34,197,94,0.08)',
                      border: `1px solid ${funnelCheck.response_time_minutes > 10 ? 'rgba(190,60,68,0.18)' : 'rgba(34,197,94,0.18)'}`,
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Скорость ответа</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: funnelCheck.response_time_minutes > 10 ? 'var(--danger)' : 'var(--success)' }}>
                        {funnelCheck.response_time_minutes} мин
                        {funnelCheck.response_time_minutes > 10 && ' ⚠'}
                      </span>
                    </div>
                  )}
                  {funnelCheck.initiative_rating && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 10,
                      background: 'rgba(119,101,227,0.06)',
                      border: '1px solid rgba(119,101,227,0.14)',
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Инициатива</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {funnelCheck.initiative_rating === 'high' ? 'Высокая' : funnelCheck.initiative_rating === 'medium' ? 'Средняя' : 'Низкая'}
                      </span>
                    </div>
                  )}
                </div>
                {funnelCheck.initiative_comment && (
                  <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>{funnelCheck.initiative_comment}</div>
                )}
              </motion.div>
            )}

            {/* Violations — strict company rule breaches */}
            {violations.length > 0 && (
              <motion.div variants={modalSectionVariants} style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
                  🚫 Нарушения правил компании
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {violations.map((v, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 13, background: 'rgba(190,60,68,0.09)', border: '1.5px solid rgba(190,60,68,0.25)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: (v.quote || v.explanation) ? 4 : 0 }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--danger)' }}>{v.rule}</span>
                        {v.timestamp && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '1px 6px' }}>{v.timestamp}</span>}
                      </div>
                      {v.quote && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 4 }}>«{v.quote}»</div>
                      )}
                      {v.explanation && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>{v.explanation}</div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Summary */}
            {summaryText && (
              <motion.div variants={modalSectionVariants} style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
                  Резюме
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {summaryText.split(/\n\n+/).map((block, bi) => {
                    const isWhatToImprove = block.trimStart().startsWith('Что бы я усилил');
                    const lines = block.split(/\n/).filter(Boolean);
                    return (
                      <div
                        key={bi}
                        style={isWhatToImprove ? {
                          background: 'rgba(119,101,227,0.05)',
                          border: '1px solid rgba(119,101,227,0.12)',
                          borderRadius: 14,
                          padding: '12px 16px',
                        } : undefined}
                      >
                        {lines.map((line, li) => {
                          const isBullet = line.trimStart().startsWith('—');
                          return (
                            <p
                              key={li}
                              style={{
                                margin: isBullet ? '4px 0 0' : '0',
                                fontSize: '0.875rem',
                                lineHeight: 1.65,
                                color: 'var(--text)',
                                paddingLeft: isBullet ? 4 : 0,
                                fontWeight: li === 0 && isWhatToImprove ? 600 : 400,
                              }}
                            >
                              {line}
                            </p>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Recommendations */}
            {(report.recommendations ?? []).length > 0 && (
              <motion.div variants={modalSectionVariants} style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
                  Рекомендации
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {report.recommendations.map((rec, i) => (
                    <li key={i} style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text)' }}>
                      {typeof rec === 'string' ? rec : (rec.text || rec.description || rec.title || '')}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Critical / high severity mistakes */}
            {criticalMistakes.length > 0 && (
              <motion.div variants={modalSectionVariants} style={{ padding: '16px 0', borderBottom: (mediumMistakes.length > 0 || minorMistakes.length > 0) ? '1px solid var(--line)' : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
                  Критично
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {criticalMistakes.map((m, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 13, background: 'rgba(190,60,68,0.07)', border: '1px solid rgba(190,60,68,0.16)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: m.description ? 4 : 0 }}>
                        {m.title && <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--danger)' }}>{m.title}</span>}
                        {m.timestamp && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '1px 6px' }}>{m.timestamp}</span>}
                      </div>
                      {m.description && <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.55 }}>{m.description}</div>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Medium severity mistakes */}
            {mediumMistakes.length > 0 && (
              <motion.div variants={modalSectionVariants} style={{ padding: '16px 0', borderBottom: minorMistakes.length > 0 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
                  Требует внимания
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mediumMistakes.map((m, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 13, background: 'rgba(185,120,18,0.07)', border: '1px solid rgba(185,120,18,0.18)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: m.description ? 4 : 0 }}>
                        {m.title && <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--warning)' }}>{m.title}</span>}
                        {m.timestamp && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '1px 6px' }}>{m.timestamp}</span>}
                      </div>
                      {m.description && <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.55 }}>{m.description}</div>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Low / neutral mistakes */}
            {minorMistakes.length > 0 && (
              <motion.div variants={modalSectionVariants} style={{ padding: '16px 0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
                  Замечание
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {minorMistakes.map((m, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 13, background: 'rgba(119,101,227,0.06)', border: '1px solid rgba(119,101,227,0.12)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: m.description ? 4 : 0 }}>
                        {m.title && <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent)' }}>{m.title}</span>}
                        {m.timestamp && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '1px 6px' }}>{m.timestamp}</span>}
                      </div>
                      {m.description && <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.55 }}>{m.description}</div>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Примеры — как сделал/а и как надо было */}
            {(() => {
              const exampleItems = (report.evidence ?? []).filter((e) => e && e.type === 'dialogue_example');
              if (!exampleItems.length) return null;
              const MALE_NAMES_A = new Set(['гриша','миша','саша','коля','серёжа','сережа','лёша','леша','витя','петя','федя','дима','стёпа','степа','сеня','тёма','тема','женя','слава','ваня','паша','вася','лёня','леня','гена','толя','тима','боря','яша','сёма','сема','кеша','лёва','лева','митя','вова','никита','данила','кирюша','андрюша']);
              const empFirst = (employeeName || '').trim().split(/\s+/)[0].toLowerCase();
              const empEndsAya = /[аяАЯ]$/u.test((employeeName || '').trim().split(/\s+/)[0]);
              const empIsFemale = empEndsAya && !MALE_NAMES_A.has(empFirst);
              const howAnswered = empIsFemale ? 'Как ответила' : 'Как ответил';
              return (
                <motion.div variants={modalSectionVariants} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
                    Примеры
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {exampleItems.map((ex, i) => {
                      const clientMsg = ex.client_message || '';
                      const clientRu = ex.client_message_ru || '';
                      const empMsg = ex.employee_response || '';
                      const empRu = ex.employee_response_ru || '';
                      const idealMsg = ex.ideal_response || '';
                      const showClientRu = clientRu && clientRu !== clientMsg;
                      const showEmpRu = empRu && empRu !== empMsg;
                      return (
                        <div key={i} style={{ borderRadius: 14, border: '1px solid rgba(119,101,227,0.15)', overflow: 'hidden' }}>
                          {ex.context && (
                            <div style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(119,101,227,0.10)', background: 'rgba(119,101,227,0.04)' }}>
                              {ex.context}
                            </div>
                          )}
                          {clientMsg && (
                            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(119,101,227,0.08)', background: 'rgba(0,0,0,0.01)' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Клиент</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>«{clientMsg}»</div>
                              {showClientRu && <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 3 }}>Перевод: {clientRu}</div>}
                            </div>
                          )}
                          {empMsg && (
                            <div style={{ padding: '10px 14px', borderBottom: idealMsg ? '1px solid rgba(119,101,227,0.10)' : 'none' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{howAnswered}</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>«{empMsg}»</div>
                              {showEmpRu && <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 3 }}>Перевод: {empRu}</div>}
                            </div>
                          )}
                          {idealMsg && (
                            <div style={{ padding: '10px 14px', background: 'rgba(119,101,227,0.04)' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Как надо было</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6 }}>{idealMsg}</div>
                              {ex.why && <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{ex.why}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })()}

            {/* Evidence — цитаты из диалога с переводом и идеальным ответом */}
            {(() => {
              const evidenceItems = (report.evidence ?? []).filter(
                (e) => e && e.type !== 'sales_department_regulation' && e.type !== 'batch_summary' && e.type !== 'dialogue_example'
              );
              if (!evidenceItems.length) return null;
              return (
                <motion.div variants={modalSectionVariants} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
                    Цитаты из диалога
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {evidenceItems.map((e, i) => {
                      const origQuote = e.quote || e.text || e.message || e.excerpt || e.description || '';
                      const ruQuote = e.quote_ru || '';
                      const showTranslation = ruQuote && ruQuote !== origQuote;
                      const label = e.rule || e.title || e.context || '';
                      const idealResponse = e.ideal_response || '';
                      if (!origQuote) return null;
                      return (
                        <div key={i} style={{ borderRadius: 13, border: '1px solid rgba(119,101,227,0.15)', overflow: 'hidden' }}>
                          {label && (
                            <div style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(119,101,227,0.10)', background: 'rgba(119,101,227,0.04)' }}>
                              {label}
                            </div>
                          )}
                          <div style={{ padding: '10px 14px', borderBottom: idealResponse ? '1px solid rgba(119,101,227,0.10)' : 'none' }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>«{origQuote}»</div>
                            {showTranslation && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                                Перевод: {ruQuote}
                              </div>
                            )}
                            {e.comment && <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{e.comment}</div>}
                          </div>
                          {idealResponse && (
                            <div style={{ padding: '10px 14px', background: 'rgba(119,101,227,0.04)' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Как надо было</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6 }}>{idealResponse}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })()}

            {/* Empty state */}
            {!hasContent && (
              <motion.p
                variants={modalSectionVariants}
                style={{ opacity: 0.4, fontSize: '0.875rem', textAlign: 'center', padding: '28px 0' }}
              >
                Данные отчёта пока недоступны.
              </motion.p>
            )}

            {/* Close / Download */}
            <motion.div
              variants={modalSectionVariants}
              style={{ paddingTop: 8, borderTop: '1px solid var(--line)', marginTop: 4, display: 'flex', gap: 10 }}
            >
              <motion.button
                className="ghost-button"
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={handleDownload}
                disabled={downloading}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              >
                <Download size={15} />
                {downloading ? 'Генерируем…' : 'Скачать PDF'}
              </motion.button>
              <motion.button
                className="ghost-button"
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                style={{ flex: 1 }}
              >
                Закрыть
              </motion.button>
            </motion.div>

          </motion.div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

// ── AddSalesModal ─────────────────────────────────────────────────────────────
const INPUT_STYLE = {
  width: '100%',
  height: 44,
  padding: '0 14px',
  border: '1px solid var(--line)',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.84)',
  color: 'var(--text)',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

export function AddSalesModal({ employees, organizationId, onClose, onSaved }) {
  useModalScrollLock();
  const showToast = useToast();
  const [empId, setEmpId] = useState(employees[0]?.id ?? '');
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10));
  const [depositsCount, setDepositsCount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (saving) return;
    if (!empId) { setError('Выберите сотрудника.'); return; }
    if (!recordDate) { setError('Укажите дату.'); return; }
    setError(null);
    const payload = {
      organization_id: organizationId,
      employee_id: empId,
      record_date: recordDate,
      deposits_count: Math.max(0, parseInt(depositsCount, 10) || 0),
      cash_amount: Math.max(0, parseFloat(cashAmount) || 0),
      note: note.trim() || null,
    };
    await runModalSuccessFlow({
      setSaving,
      action: async () => {
        const { error: err } = await supabase.from('employee_sales').insert(payload);
        if (err) throw err;
      },
      reload: () => onSaved?.(),
      reset: () => {
        setEmpId(employees[0]?.id ?? '');
        setRecordDate(new Date().toISOString().slice(0, 10));
        setDepositsCount('');
        setCashAmount('');
        setNote('');
      },
      toast: () => showToast?.('Показатели сохранены'),
      close: onClose,
      onError: (err) => {
        console.error('[AddSalesModal] insert error:', err);
        setError('Ошибка при сохранении. Проверьте соединение.');
      },
    });
  };

  if (employees.length === 0) {
    return (
      <ModalPortal>
        <motion.div className="modal-backdrop employee-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="modal-shell modal-shell--small" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" initial={modalMotion.initial} animate={modalMotion.animate} exit={modalMotion.exit} transition={modalMotion.transition}>
            <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
              <motion.div className="modal-title" variants={modalSectionVariants}>
                <h2 style={{ fontSize: 18 }}>Добавить показатели</h2>
                <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
              </motion.div>
              <motion.p variants={modalSectionVariants} style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                Сначала добавьте сотрудников на странице «Сотрудники».
              </motion.p>
              <motion.div className="modal-actions" variants={modalSectionVariants} style={{ marginTop: 16 }}>
                <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>Закрыть</motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop employee-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div
          className="modal-shell modal-shell--medium"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          initial={modalMotion.initial}
          animate={modalMotion.animate}
          exit={modalMotion.exit}
          transition={modalMotion.transition}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Продажи</span>
                <h2 style={{ margin: '2px 0 0', fontSize: 20 }}>Добавить показатели</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            <motion.div variants={modalSectionVariants} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="sales-field">
                <span>Сотрудник</span>
                <CustomSelect
                  value={empId}
                  options={employees.map((e) => ({ value: e.id, label: e.name }))}
                  onChange={setEmpId}
                  placeholder="Выбрать сотрудника"
                />
              </label>
              <label className="sales-field">
                <span>Дата</span>
                <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} style={INPUT_STYLE} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="sales-field">
                  <span>Кол-во депозитов</span>
                  <input type="number" min="0" step="1" value={depositsCount} onChange={(e) => setDepositsCount(e.target.value)} placeholder="0" style={INPUT_STYLE} />
                </label>
                <label className="sales-field">
                  <span>Сумма (₽)</span>
                  <input type="number" min="0" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0.00" style={INPUT_STYLE} />
                </label>
              </div>
              <label className="sales-field">
                <span>Комментарий <em style={{ fontStyle: 'normal', opacity: 0.55 }}>(необязательно)</em></span>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Акция, крупный клиент…" style={INPUT_STYLE} />
              </label>
            </motion.div>

            {error && (
              <motion.p variants={modalSectionVariants} style={{ margin: '10px 0 0', fontSize: '0.82rem', color: 'var(--danger)' }}>
                {error}
              </motion.p>
            )}

            <motion.div className="modal-actions" variants={modalSectionVariants} style={{ marginTop: 20 }}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
                Отмена
              </motion.button>
              <motion.button className="primary-button" type="button" whileTap={{ scale: saving ? 1 : 0.97 }} disabled={saving} onClick={handleSave}>
                <BadgeDollarSign size={15} />
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

// ── StatusManagementModal ─────────────────────────────────────────────────────
export function StatusManagementModal({ statuses, organizationId, onClose, onAdd, onDelete }) {
  useModalScrollLock();
  const showToast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState(STATUS_PRESETS[0]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    if (statuses.some((s) => s.name === trimmed)) {
      setAddError('Статус с таким названием уже существует.');
      return;
    }
    setAddError(null);
    await runModalSuccessFlow({
      setSaving: setAdding,
      action: async () => {
        const { data, error } = await supabase
          .from('employee_statuses')
          .insert({ name: trimmed, color, organization_id: organizationId })
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      reset: (data) => {
        onAdd(data);
        setName('');
      },
      toast: () => showToast?.('Статус создан'),
      close: onClose,
      onError: (error) => {
        console.error('[StatusManagementModal] insert error:', error);
        setAddError('Ошибка при сохранении. Проверьте соединение.');
      },
    });
  };

  const handleDelete = async (statusId) => {
    await runModalSuccessFlow({
      setSaving: (active) => setDeletingId(active ? statusId : null),
      action: async () => {
        const { error } = await supabase
          .from('employee_statuses')
          .delete()
          .eq('id', statusId)
          .eq('organization_id', organizationId);
        if (error) throw error;
        return statusId;
      },
      reset: (deletedId) => onDelete(deletedId),
      toast: () => showToast?.('Статус удалён'),
      close: onClose,
      onError: (error) => {
        console.error('[StatusManagementModal] delete error:', error);
      },
    });
  };

  return (
    <ModalPortal>
      <motion.div
        className="modal-backdrop employee-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-shell modal-shell--small"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          initial={modalMotion.initial}
          animate={modalMotion.animate}
          exit={modalMotion.exit}
          transition={modalMotion.transition}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">

            {/* Header */}
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Настройки команды</span>
                <h2>Статусы сотрудников</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}>
                <X size={18} />
              </button>
            </motion.div>

            {/* Existing statuses */}
            <motion.div variants={modalSectionVariants} style={{ marginBottom: 20 }}>
              <div className="status-mgmt-section-label">Текущие статусы</div>
              {statuses.length === 0 ? (
                <p className="status-mgmt-empty">Пока нет статусов. Создайте первый ниже.</p>
              ) : (
                <div className="status-mgmt-list">
                  {statuses.map((s) => (
                    <div key={s.id} className="status-mgmt-row">
                      <span className="status-mgmt-dot" style={{ background: s.color }} />
                      <span className="status-mgmt-name">{s.name}</span>
                      <motion.button
                        className="status-mgmt-delete"
                        type="button"
                        whileTap={{ scale: 0.88 }}
                        disabled={deletingId === s.id}
                        onClick={() => handleDelete(s.id)}
                        aria-label={`Удалить статус ${s.name}`}
                      >
                        <Trash2 size={13} />
                      </motion.button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Add new status */}
            <motion.form variants={modalSectionVariants} onSubmit={handleAdd}>
              <div className="status-mgmt-section-label">Новый статус</div>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setAddError(null); }}
                placeholder="Например, В обучении"
                className="status-mgmt-input"
              />
              <div className="status-mgmt-section-label" style={{ marginTop: 12 }}>Цвет</div>
              <div className="status-color-grid">
                {STATUS_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`status-color-swatch${color === c ? ' selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Цвет ${c}`}
                  />
                ))}
              </div>

              {/* Preview */}
              {name.trim() && (
                <div style={{ margin: '12px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Превью:</span>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: `${color}1e`,
                      border: `1px solid ${color}4d`,
                      color: color,
                    }}
                  >
                    {name.trim()}
                  </span>
                </div>
              )}

              {addError && (
                <p style={{ fontSize: '0.82rem', color: 'var(--danger)', margin: '8px 0 0' }}>{addError}</p>
              )}

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
                  Закрыть
                </motion.button>
                <motion.button
                  className="primary-button"
                  type="submit"
                  whileTap={{ scale: name.trim() && !adding ? 0.97 : 1 }}
                  disabled={!name.trim() || adding}
                >
                  <Plus size={15} />
                  {adding ? 'Создаём…' : 'Создать статус'}
                </motion.button>
              </div>
            </motion.form>

          </motion.div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

// ── ChannelManagementModal ────────────────────────────────────────────────────
export function ChannelManagementModal({ channels, organizationId, onClose, onAdd, onDelete, employees = [], onAssignEmployee }) {
  useModalScrollLock();
  const showToast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState(STATUS_PRESETS[0]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedChannel, setExpandedChannel] = useState(null);
  const [assigningSaving, setAssigningSaving] = useState(null);
  // Local channel map so consecutive toggles see the latest state (employees prop is stale)
  const [channelMap, setChannelMap] = useState(() =>
    Object.fromEntries(employees.map((e) => [e.id, e.channel ?? '']))
  );
  const getEffectiveChannel = (employee) => channelMap[employee.id] ?? employee.channel ?? '';

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    if (channels.some((channel) => channel.name === trimmed)) {
      setAddError('Канал с таким названием уже существует.');
      return;
    }
    setAddError(null);
    await runModalSuccessFlow({
      setSaving: setAdding,
      action: async () => {
        const { data, error } = await supabase
          .from('employee_channels')
          .insert({ name: trimmed, color, organization_id: organizationId })
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      reset: (data) => {
        onAdd(data);
        setName('');
      },
      toast: () => showToast?.('Канал создан'),
      close: onClose,
      onError: (error) => {
        console.error('[ChannelManagementModal] insert error:', error);
        setAddError('Ошибка при сохранении. Проверьте соединение.');
      },
    });
  };

  const handleDelete = async (channel) => {
    await runModalSuccessFlow({
      setSaving: (active) => setDeletingId(active ? channel.id : null),
      action: async () => {
        const { error: clearError } = await supabase
          .from('employees')
          .update({ channel: null })
          .eq('organization_id', organizationId)
          .eq('channel', channel.name);
        if (clearError) throw clearError;

        const { error } = await supabase
          .from('employee_channels')
          .delete()
          .eq('id', channel.id)
          .eq('organization_id', organizationId);
        if (error) throw error;
        return channel;
      },
      reset: (deletedChannel) => onDelete(deletedChannel.id, deletedChannel.name),
      toast: () => showToast?.('Канал удалён'),
      close: onClose,
      onError: (error) => {
        console.error('[ChannelManagementModal] delete error:', error);
      },
    });
  };

  const handleToggleEmployee = async (employee, channelName) => {
    const key = `${employee.id}:${channelName}`;
    if (assigningSaving === key) return;
    const effective = getEffectiveChannel(employee);
    const currentChannels = effective
      ? effective.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const isInChannel = currentChannels.includes(channelName);
    const updatedChannels = isInChannel
      ? currentChannels.filter((c) => c !== channelName)
      : [...currentChannels, channelName];
    const newChannel = updatedChannels.join(',') || null;
    setAssigningSaving(key);
    const { error } = await supabase
      .from('employees')
      .update({ channel: newChannel })
      .eq('id', employee.id)
      .eq('organization_id', organizationId);
    setAssigningSaving(null);
    if (!error) {
      const saved = newChannel ?? '';
      setChannelMap((prev) => ({ ...prev, [employee.id]: saved }));
      onAssignEmployee?.(employee.id, saved);
      showToast?.(isInChannel ? 'Сотрудник удалён из канала' : 'Сотрудник добавлен в канал');
    }
  };

  return (
    <ModalPortal>
      <motion.div
        className="modal-backdrop employee-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-shell modal-shell--small"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          initial={modalMotion.initial}
          animate={modalMotion.animate}
          exit={modalMotion.exit}
          transition={modalMotion.transition}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Настройки команды</span>
                <h2>Каналы сотрудников</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}>
                <X size={18} />
              </button>
            </motion.div>

            <motion.div variants={modalSectionVariants} style={{ marginBottom: 20 }}>
              <div className="status-mgmt-section-label">Текущие каналы</div>
              {channels.length === 0 ? (
                <p className="status-mgmt-empty">Пока нет каналов. Создайте первый ниже.</p>
              ) : (
                <div className="status-mgmt-list">
                  {channels.map((channel) => {
                    const isExpanded = expandedChannel === channel.id;
                    const memberCount = employees.filter((e) => getEffectiveChannel(e).split(',').map((s) => s.trim()).includes(channel.name)).length;
                    return (
                      <div key={channel.id} className="channel-mgmt-card">
                        <div className="status-mgmt-row" style={{ cursor: 'pointer' }} onClick={() => setExpandedChannel(isExpanded ? null : channel.id)}>
                          <span className="status-mgmt-dot" style={{ background: channel.color }} />
                          <span className="status-mgmt-name">{channel.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginLeft: 4 }}>{memberCount} чел.</span>
                          <span style={{ marginLeft: 'auto', color: 'var(--muted)', display: 'flex' }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </span>
                          <motion.button
                            className="status-mgmt-delete"
                            type="button"
                            whileTap={{ scale: 0.88 }}
                            disabled={deletingId === channel.id}
                            onClick={(e) => { e.stopPropagation(); handleDelete(channel); }}
                            aria-label={`Удалить канал ${channel.name}`}
                          >
                            <Trash2 size={13} />
                          </motion.button>
                        </div>
                        {isExpanded && (
                          <div className="channel-mgmt-members">
                            {employees.length === 0 ? (
                              <p style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 12px' }}>Нет сотрудников</p>
                            ) : (
                              employees.map((employee) => {
                                const inChannel = getEffectiveChannel(employee).split(',').map((s) => s.trim()).includes(channel.name);
                                const saving = assigningSaving === `${employee.id}:${channel.name}`;
                                return (
                                  <button
                                    key={employee.id}
                                    type="button"
                                    className={`channel-mgmt-member ${inChannel ? 'active' : ''}`}
                                    disabled={saving}
                                    onClick={() => handleToggleEmployee(employee, channel.name)}
                                  >
                                    <Avatar name={employee.name} size={24} />
                                    <span>{employee.name}</span>
                                    {inChannel && <Check size={13} style={{ marginLeft: 'auto', color: channel.color }} />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            <motion.form variants={modalSectionVariants} onSubmit={handleAdd}>
              <div className="status-mgmt-section-label">Новый канал</div>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setAddError(null); }}
                placeholder="Например, Telegram"
                className="status-mgmt-input"
              />
              <div className="status-mgmt-section-label" style={{ marginTop: 12 }}>Цвет</div>
              <div className="status-color-grid">
                {STATUS_PRESETS.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    className={`status-color-swatch${color === presetColor ? ' selected' : ''}`}
                    style={{ background: presetColor }}
                    onClick={() => setColor(presetColor)}
                    aria-label={`Цвет ${presetColor}`}
                  />
                ))}
              </div>

              {name.trim() && (
                <div style={{ margin: '12px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Превью:</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: `${color}1e`,
                      border: `1px solid ${color}4d`,
                      color: color,
                    }}
                  >
                    <span className="status-mgmt-dot" style={{ background: color }} />
                    {name.trim()}
                  </span>
                </div>
              )}

              {addError && (
                <p style={{ fontSize: '0.82rem', color: 'var(--danger)', margin: '8px 0 0' }}>{addError}</p>
              )}

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
                  Закрыть
                </motion.button>
                <motion.button
                  className="primary-button"
                  type="submit"
                  whileTap={{ scale: name.trim() && !adding ? 0.97 : 1 }}
                  disabled={!name.trim() || adding}
                >
                  <Plus size={15} />
                  {adding ? 'Создаём…' : 'Создать канал'}
                </motion.button>
              </div>
            </motion.form>
          </motion.div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}
