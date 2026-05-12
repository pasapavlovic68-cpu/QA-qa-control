import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus, Search, Trash2, X } from 'lucide-react';
import { supabase, fetchWithTimeout } from '../lib/supabase.js';
import { useToast } from '../components/Toast.jsx';
import { isCheckedEmployee } from '../lib/employees.js';
import { runModalSuccessFlow } from '../lib/modalSuccess.js';
import { AnimatedProgress, Avatar } from '../components/shared.jsx';
import { reportCardTransition, ReviewReportModal } from '../components/modals.jsx';
import { ModalPortal, modalContentVariants, modalMotion, modalSectionVariants, useModalScrollLock } from '../components/modal.jsx';

function toReport(row, employeeMap, checkMap) {
  const mistakes = Array.isArray(row.mistakes) ? row.mistakes : [];
  const positives = Array.isArray(row.positives) ? row.positives : [];
  const recommendations = Array.isArray(row.recommendations) ? row.recommendations : [];
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const criticalCount = mistakes.filter((m) => m.severity === 'critical').length;
  const employeeName = employeeMap[row.employee_id] || 'Сотрудник';
  const summary = row.management_summary || '';
  // dialogues_count lives in qa_checks; look it up by check_id
  const dialogs = (checkMap && row.check_id) ? (checkMap[row.check_id] ?? 0) : 0;

  return {
    id: row.id,
    checkId: row.check_id,
    employeeId: row.employee_id,
    employee: employeeName,
    score: row.score ?? 0,
    title: row.title || 'Отчёт',
    summary,
    management: summary,
    createdAt: row.created_at,
    date: row.created_at ? new Date(row.created_at).toLocaleDateString('ru-RU') : '',
    status: 'Готово',
    tone: 'success',
    dialogs,
    critical: criticalCount,
    mistakes,
    positives,
    recommendations,
    evidence
  };
}

function severityRank(severity) {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function buildEmployeeReports(reports) {
  const groups = new Map();

  reports.forEach((report) => {
    const key = report.employeeId || `unknown-${report.employee}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        employeeId: report.employeeId,
        employee: report.employee,
        reports: [],
      });
    }
    groups.get(key).reports.push(report);
  });

  return Array.from(groups.values())
    .map((group) => {
      const sortedReports = [...group.reports].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      const reportCount = sortedReports.length;
      const dialogs = sortedReports.reduce((sum, report) => sum + (report.dialogs || 0), 0);
      const avgScore = reportCount
        ? Math.round(sortedReports.reduce((sum, report) => sum + (report.score || 0), 0) / reportCount)
        : 0;
      const mistakes = sortedReports.flatMap((report) => report.mistakes ?? []);
      const critical = mistakes.filter((item) => item.severity === 'critical' || item.severity === 'high').length;
      const latest = sortedReports[0];
      const topMistakes = [...mistakes]
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
        .slice(0, 4);
      const recommendations = sortedReports.flatMap((report) => report.recommendations ?? []).slice(0, 4);

      return {
        ...group,
        reports: sortedReports,
        reportCount,
        dialogs,
        avgScore,
        critical,
        latest,
        topMistakes,
        recommendations,
        date: latest?.date || '',
        summary: latest?.summary || '',
      };
    })
    .sort((a, b) => new Date(b.latest?.createdAt || b.latest?.date) - new Date(a.latest?.createdAt || a.latest?.date));
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function getWeekBounds(baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  const mondayOffset = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end, startKey: toDateKey(start), endKey: toDateKey(end) };
}

function shiftWeek(bounds, direction) {
  const next = new Date(bounds.start);
  next.setDate(bounds.start.getDate() + direction * 7);
  return getWeekBounds(next);
}

function formatShortDate(dateValue) {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatManualPeriod(start, end) {
  return `${formatShortDate(start)}-${formatShortDate(end)}`;
}

function calculateL2D(dialogues, fd) {
  const dialogueCount = Number(dialogues) || 0;
  const fdCount = Number(fd) || 0;
  if (fdCount <= 0) return 0;
  return dialogueCount / fdCount * 100;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function toManualReport(row, employeeMap) {
  const employee = employeeMap[row.employee_id] ?? {};
  const dialogues = Number(row.dialogues_count) || 0;
  const fd = Number(row.fd_count) || 0;
  return {
    id: row.id,
    employeeId: row.employee_id,
    employee: employee.name || 'Сотрудник',
    role: employee.role || 'Сотрудник',
    channel: employee.channel || '',
    periodStart: row.period_start,
    periodEnd: row.period_end,
    dialogues,
    fd,
    rd: Number(row.rd_count) || 0,
    fdAmount: Number(row.fd_amount) || 0,
    rdAmount: Number(row.rd_amount) || 0,
    avgResponseTime: row.avg_response_time || '',
    notes: row.notes || '',
    recommendations: row.recommendations || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    l2d: calculateL2D(dialogues, fd),
  };
}

function buildManualReportText(report) {
  const lines = [
    'Доброе утро.',
    `${report.channel ? `${report.channel} ` : ''}${report.employee}`,
    `Период: ${formatManualPeriod(report.periodStart, report.periodEnd)}`,
    '',
    `${report.employee}:`,
    `${report.dialogues} диалогов`,
    `фд-${report.fd}`,
    `рд-${report.rd}`,
    `l2d-${formatPercent(report.l2d)}`,
  ];

  if (report.avgResponseTime) lines.push(`среднее время ответа: ${report.avgResponseTime}`);
  if (report.fdAmount) lines.push(`сумма ФД: ${report.fdAmount}`);
  if (report.rdAmount) lines.push(`сумма РД: ${report.rdAmount}`);
  if (report.notes) lines.push('', report.notes);
  if (report.recommendations) lines.push('', 'Рекомендации:', report.recommendations);

  return lines.join('\n');
}

function ManualReportFormModal({ employees, period, organizationId, onClose, onSaved }) {
  useModalScrollLock();

  const showToast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? '',
    dialogues: '',
    fd: '',
    rd: '',
    fdAmount: '',
    rdAmount: '',
    avgResponseTime: '',
    notes: '',
    recommendations: '',
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const resetForm = () => {
    setForm({
      employeeId: employees[0]?.id ?? '',
      dialogues: '',
      fd: '',
      rd: '',
      fdAmount: '',
      rdAmount: '',
      avgResponseTime: '',
      notes: '',
      recommendations: '',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const employeeId = form.employeeId;
    const dialogues = Number(form.dialogues);
    const fd = Number(form.fd);

    if (!employeeId) {
      setError('Выберите сотрудника.');
      return;
    }

    if (!Number.isFinite(dialogues) || dialogues < 0 || !Number.isFinite(fd) || fd < 0) {
      setError('Диалоги и ФД должны быть числами от 0.');
      return;
    }

    setError('');
    const payload = {
      organization_id: organizationId,
      employee_id: employeeId,
      period_start: period.startKey,
      period_end: period.endKey,
      dialogues_count: dialogues,
      fd_count: fd,
      rd_count: Number(form.rd) || 0,
      fd_amount: Number(form.fdAmount) || 0,
      rd_amount: Number(form.rdAmount) || 0,
      avg_response_time: form.avgResponseTime.trim() || null,
      notes: form.notes.trim() || null,
      recommendations: form.recommendations.trim() || null,
      updated_at: new Date().toISOString(),
    };

    await runModalSuccessFlow({
      setSaving,
      action: async () => {
        const { data, error: saveError } = await supabase
          .from('manual_employee_reports')
          .upsert(payload, { onConflict: 'organization_id,employee_id,period_start' })
          .select('*')
          .maybeSingle();
        if (saveError) throw saveError;
        return data;
      },
      reload: onSaved,
      reset: resetForm,
      toast: () => showToast?.('Отчёт сохранён'),
      close: onClose,
      onError: (saveError) => {
        console.error('[ManualReports] save error:', saveError);
        setError(saveError?.message || 'Не удалось сохранить отчёт.');
      },
    });
  };

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop employee-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.form
          className="modal-shell modal-shell--large manual-report-modal"
          onClick={(event) => event.stopPropagation()}
          onSubmit={handleSubmit}
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
                <span className="eyebrow">Ручной отчёт</span>
                <h2>Добавить отчёт</h2>
                <p>{formatManualPeriod(period.start, period.end)} · L2D считается автоматически</p>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            <motion.div className="manual-report-form-grid" variants={modalSectionVariants}>
              <label>
                <span>Сотрудник</span>
                <select value={form.employeeId} onChange={updateField('employeeId')} autoFocus>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Диалоги</span>
                <input type="number" min="0" value={form.dialogues} onChange={updateField('dialogues')} placeholder="221" />
              </label>
              <label>
                <span>ФД</span>
                <input type="number" min="0" value={form.fd} onChange={updateField('fd')} placeholder="8" />
              </label>
              <label>
                <span>РД</span>
                <input type="number" min="0" value={form.rd} onChange={updateField('rd')} placeholder="3" />
              </label>
              <label>
                <span>Сумма ФД</span>
                <input type="number" min="0" step="0.01" value={form.fdAmount} onChange={updateField('fdAmount')} placeholder="386.90" />
              </label>
              <label>
                <span>Сумма РД</span>
                <input type="number" min="0" step="0.01" value={form.rdAmount} onChange={updateField('rdAmount')} placeholder="263.94" />
              </label>
              <label>
                <span>Среднее время ответа</span>
                <input value={form.avgResponseTime} onChange={updateField('avgResponseTime')} placeholder="00:13" />
              </label>
              <div className="manual-report-calculated">
                <span>L2D</span>
                <strong>{formatPercent(calculateL2D(form.dialogues, form.fd))}</strong>
                <small>Диалоги / ФД × 100</small>
              </div>
              <label className="manual-report-wide">
                <span>Наблюдения</span>
                <textarea value={form.notes} onChange={updateField('notes')} placeholder="Что заметили по сотруднику за неделю" />
              </label>
              <label className="manual-report-wide">
                <span>Рекомендации</span>
                <textarea value={form.recommendations} onChange={updateField('recommendations')} placeholder="Что нужно улучшить" />
              </label>
            </motion.div>

            {error && <motion.p className="status-error" variants={modalSectionVariants}>{error}</motion.p>}

            <motion.div className="modal-actions" variants={modalSectionVariants}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose} disabled={saving}>Отмена</motion.button>
              <motion.button className="primary-button" type="submit" whileTap={{ scale: saving ? 1 : 0.97 }} disabled={saving}>
                {saving ? 'Сохраняем…' : 'Сохранить отчёт'}
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.form>
      </motion.div>
    </ModalPortal>
  );
}

function ManualReportTextModal({ report, onClose }) {
  useModalScrollLock();
  const showToast = useToast();
  const reportText = buildManualReportText(report);

  const copyText = async () => {
    await navigator.clipboard.writeText(reportText);
    showToast?.('Отчёт скопирован');
  };

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop employee-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div
          className="modal-shell modal-shell--medium manual-report-copy-modal"
          onClick={(event) => event.stopPropagation()}
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
                <span className="eyebrow">Готовый текст</span>
                <h2>Отчёт {report.employee}</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>
            <motion.pre className="manual-report-text" variants={modalSectionVariants}>{reportText}</motion.pre>
            <motion.div className="modal-actions" variants={modalSectionVariants}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>Закрыть</motion.button>
              <motion.button className="primary-button" type="button" whileTap={{ scale: 0.97 }} onClick={copyText}>
                <Copy size={16} />
                Скопировать
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

function EmployeeReportModal({ group, onClose, onOpenReport }) {
  useModalScrollLock();

  if (!group) return null;

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
          layoutId={`report-employee-${group.id}`}
          className="modal-shell modal-shell--large employee-report-modal"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          transition={reportCardTransition}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div className="employee-report-title">
                <Avatar name={group.employee} />
                <div>
                  <span className="eyebrow">Отчёты сотрудника</span>
                  <h2>{group.employee}</h2>
                  <p>{group.reportCount} проверок · {group.dialogs} диалогов</p>
                </div>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            <motion.div className="employee-report-summary-grid" variants={modalSectionVariants}>
              <div>
                <span>Средняя оценка</span>
                <strong>{group.avgScore}</strong>
              </div>
              <div>
                <span>Проверок</span>
                <strong>{group.reportCount}</strong>
              </div>
              <div>
                <span>Диалогов</span>
                <strong>{group.dialogs}</strong>
              </div>
              <div>
                <span>Критично</span>
                <strong>{group.critical}</strong>
              </div>
            </motion.div>

            {group.summary && (
              <motion.div className="employee-report-section" variants={modalSectionVariants}>
                <span className="employee-report-section-label">Последний вывод</span>
                <p>{group.summary}</p>
              </motion.div>
            )}

            {group.topMistakes.length > 0 && (
              <motion.div className="employee-report-section" variants={modalSectionVariants}>
                <span className="employee-report-section-label">Частые ошибки</span>
                <div className="employee-report-chip-list">
                  {group.topMistakes.map((mistake, index) => (
                    <span key={`${mistake.title}-${index}`}>{mistake.title || mistake.description || 'Замечание'}</span>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div className="employee-report-section" variants={modalSectionVariants}>
              <span className="employee-report-section-label">Проверки</span>
              <div className="employee-report-list">
                {group.reports.map((report) => (
                  <button
                    key={report.id}
                    className="employee-report-row"
                    type="button"
                    onClick={() => onOpenReport(report)}
                  >
                    <span>
                      <strong>{report.title}</strong>
                      <small>{report.date} · {report.dialogs} диал.</small>
                    </span>
                    <b>{report.score}</b>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

function DeleteReportGroupModal({ group, saving, error, onCancel, onConfirm }) {
  useModalScrollLock();

  if (!group) return null;

  return (
    <ModalPortal>
      <motion.div
        className="modal-backdrop employee-modal-backdrop subtle"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          className="modal-shell modal-shell--small delete-modal"
          role="dialog"
          aria-modal="true"
          initial={modalMotion.initial}
          animate={modalMotion.animate}
          exit={modalMotion.exit}
          transition={modalMotion.transition}
          onClick={(event) => event.stopPropagation()}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="delete-icon" variants={modalSectionVariants}><Trash2 size={18} /></motion.div>
            <motion.h2 variants={modalSectionVariants}>Удалить отчёты?</motion.h2>
            <motion.p variants={modalSectionVariants}>
              Все отчёты сотрудника {group.employee} будут удалены из истории проверок. Статистика сотрудника пересчитается по оставшимся данным.
            </motion.p>
            {error && (
              <motion.p className="report-delete-error" variants={modalSectionVariants}>{error}</motion.p>
            )}
            <motion.div className="modal-actions" variants={modalSectionVariants}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onCancel} disabled={saving}>
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

export function Report({ organizationId }) {
  const showToast = useToast();
  const [reportMode, setReportMode] = useState('manual');
  const [reports, setReports] = useState([]);
  const [manualReports, setManualReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [week, setWeek] = useState(() => getWeekBounds());
  const [loading, setLoading] = useState(true);
  const [manualLoading, setManualLoading] = useState(true);
  const [manualError, setManualError] = useState('');
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualTextReport, setManualTextReport] = useState(null);
  const [selectedEmployeeReport, setSelectedEmployeeReport] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [query, setQuery] = useState('');

  const loadReports = async ({ showLoader = false } = {}) => {
    if (!organizationId) return;
    if (showLoader) setLoading(true);

    console.log('[PostAnalysisDataFlow] Report: fetching reports, employees, qa_checks');
    const [reportsResult, employeesResult, checksResult] = await Promise.all([
      fetchWithTimeout(
        supabase
          .from('reports')
          .select('id, check_id, employee_id, score, title, management_summary, mistakes, positives, recommendations, evidence, created_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false }),
        'Report'
      ),
      fetchWithTimeout(
        supabase.from('employees').select('id, name').eq('organization_id', organizationId),
        'Report:employees'
      ),
      fetchWithTimeout(
        supabase.from('qa_checks').select('id, dialogues_count').eq('organization_id', organizationId),
        'Report:checks'
      )
    ]);

    const employeeMap = {};
    (employeesResult.data ?? []).forEach((e) => { employeeMap[e.id] = e.name; });

    // Map check id → dialogues_count so toReport can fill the dialogs field
    const checkMap = {};
    (checksResult.data ?? []).forEach((c) => { checkMap[c.id] = c.dialogues_count ?? 0; });
    console.log(`[PostAnalysisDataFlow] Report: checkMap has ${Object.keys(checkMap).length} entries`);

    if (reportsResult.error) {
      console.error('[Report] reports fetch error:', reportsResult.error);
      setLoading(false);
      return;
    }

    setReports((reportsResult.data ?? []).map((row) => toReport(row, employeeMap, checkMap)));
    setLoading(false);
  };

  const loadManualReports = async ({ showLoader = false } = {}) => {
    if (!organizationId) return;
    if (showLoader) setManualLoading(true);
    setManualError('');

    const [employeesResult, manualResult] = await Promise.all([
      fetchWithTimeout(
        supabase
          .from('employees')
          .select('id, name, role, channel, auth_user_id')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false }),
        'ManualReports:employees'
      ),
      fetchWithTimeout(
        supabase
          .from('manual_employee_reports')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('period_start', week.startKey)
          .order('created_at', { ascending: false }),
        'ManualReports'
      ),
    ]);

    if (employeesResult.error) {
      console.error('[ManualReports] employees fetch error:', employeesResult.error);
      setManualError('Не удалось загрузить сотрудников.');
      setManualLoading(false);
      return;
    }

    const checkedEmployees = (employeesResult.data ?? []).filter(isCheckedEmployee);
    setEmployees(checkedEmployees);

    if (manualResult.error) {
      console.error('[ManualReports] reports fetch error:', manualResult.error);
      setManualError(
        manualResult.error.code === '42P01'
          ? 'Таблица manual_employee_reports ещё не создана в Supabase.'
          : 'Не удалось загрузить ручные отчёты.'
      );
      setManualReports([]);
      setManualLoading(false);
      return;
    }

    const employeeMap = {};
    checkedEmployees.forEach((employee) => {
      employeeMap[employee.id] = employee;
    });

    setManualReports((manualResult.data ?? []).map((row) => toManualReport(row, employeeMap)));
    setManualLoading(false);
  };

  useEffect(() => {
    loadReports({ showLoader: true }).catch((error) => {
      console.error('[Report] load error:', error);
      setLoading(false);
    });
  }, [organizationId]);

  useEffect(() => {
    loadManualReports({ showLoader: true }).catch((error) => {
      console.error('[ManualReports] load error:', error);
      setManualError(error?.message || 'Не удалось загрузить ручные отчёты.');
      setManualLoading(false);
    });
  }, [organizationId, week.startKey]);

  const employeeReports = buildEmployeeReports(reports);
  const filteredManualReports = manualReports.filter((report) => {
    const searchValue = `${report.employee} ${report.channel} ${report.notes} ${report.recommendations}`.toLowerCase();
    return searchValue.includes(query.toLowerCase());
  });

  const filteredReports = employeeReports.filter((group) => {
    const reportText = group.reports.map((report) => `${report.title} ${report.summary}`).join(' ');
    const searchValue = `${group.employee} ${group.summary} ${reportText}`.toLowerCase();
    return searchValue.includes(query.toLowerCase());
  });

  const openDeleteReportGroup = (event, group) => {
    event.stopPropagation();
    setDeleteTarget(group);
    setDeleteError(null);
  };

  const handleDeleteReportGroup = async () => {
    if (!deleteTarget || deleteSaving) return;

    const reportIds = deleteTarget.reports.map((report) => report.id).filter(Boolean);
    const checkIds = [...new Set(deleteTarget.reports.map((report) => report.checkId).filter(Boolean))];
    const remainingReports = reports.filter((report) => !reportIds.includes(report.id));
    const remainingEmployeeReports = remainingReports.filter((report) => report.employeeId === deleteTarget.employeeId);
    const remainingDialogsCount = remainingEmployeeReports.reduce((sum, report) => sum + (report.dialogs || 0), 0);
    const remainingAvgScore = remainingEmployeeReports.length
      ? Math.round(remainingEmployeeReports.reduce((sum, report) => sum + (report.score || 0), 0) / remainingEmployeeReports.length)
      : 0;

    setDeleteSaving(true);
    setDeleteError(null);

    try {
      if (checkIds.length > 0) {
        const { error: dialoguesError } = await supabase
          .from('uploaded_dialogues')
          .delete()
          .eq('organization_id', organizationId)
          .in('check_id', checkIds);

        if (dialoguesError) throw dialoguesError;
      }

      if (reportIds.length > 0) {
        const { data: deletedReports, error: reportsError } = await supabase
          .from('reports')
          .delete()
          .eq('organization_id', organizationId)
          .in('id', reportIds)
          .select('id');

        if (reportsError) throw reportsError;
        if ((deletedReports ?? []).length !== reportIds.length) {
          console.error('[ReportDelete] reports delete affected rows mismatch:', {
            expected: reportIds.length,
            deleted: deletedReports?.length ?? 0,
            reportIds
          });
          throw new Error('Отчёт не удалён в базе. Вероятно, DELETE заблокирован RLS-политикой для reports.');
        }
      }

      if (checkIds.length > 0) {
        const { data: deletedChecks, error: checksError } = await supabase
          .from('qa_checks')
          .delete()
          .eq('organization_id', organizationId)
          .in('id', checkIds)
          .select('id');

        if (checksError) throw checksError;
        if ((deletedChecks ?? []).length !== checkIds.length) {
          console.warn('[ReportDelete] qa_checks delete affected rows mismatch:', {
            expected: checkIds.length,
            deleted: deletedChecks?.length ?? 0,
            checkIds
          });
        }
      }

      if (deleteTarget.employeeId) {
        const { error: employeeError } = await supabase
          .from('employees')
          .update({
            checks_count: remainingDialogsCount,
            score: remainingAvgScore
          })
          .eq('organization_id', organizationId)
          .eq('id', deleteTarget.employeeId);

        if (employeeError) throw employeeError;
      }

      await loadReports();
      setSelectedEmployeeReport(null);
      setSelectedReport(null);
      setDeleteTarget(null);
      showToast?.('Отчёты удалены');
    } catch (error) {
      console.error('[ReportDelete] delete error:', error);
      setDeleteError(error?.message || 'Не удалось удалить отчёт.');
      showToast?.('Не удалось удалить отчёт', 'error');
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <>
      <div className="reports-head">
        <div>
          <span className="eyebrow">{reportMode === 'manual' ? 'Ручная статистика' : 'История проверок'}</span>
          <h2>{reportMode === 'manual' ? 'Отчёты сотрудников' : 'Сформированные отчёты'}</h2>
        </div>
        <div className="reports-head-actions">
          <div className="reports-mode-switch">
            <button className={reportMode === 'manual' ? 'active' : ''} type="button" onClick={() => setReportMode('manual')}>Ручные</button>
            <button className={reportMode === 'ai' ? 'active' : ''} type="button" onClick={() => setReportMode('ai')}>AI</button>
          </div>
          <label className="report-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти отчёт или сотрудника" />
          </label>
          {reportMode === 'manual' && (
            <motion.button className="primary-button" type="button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={() => setManualFormOpen(true)}>
              <Plus size={17} />
              Добавить отчёт
            </motion.button>
          )}
        </div>
      </div>

      {reportMode === 'manual' && (
        <div className="manual-report-period-bar">
          <div>
            <span className="eyebrow">Период</span>
            <strong>{formatManualPeriod(week.start, week.end)}</strong>
            <small>Понедельник-воскресенье</small>
          </div>
          <div className="manual-report-week-actions">
            <button type="button" onClick={() => setWeek((current) => shiftWeek(current, -1))}><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => setWeek(getWeekBounds())}><CalendarDays size={16} /> Текущая</button>
            <button type="button" onClick={() => setWeek((current) => shiftWeek(current, 1))}><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {reportMode === 'manual' ? (
        manualLoading ? (
          <div className="reports-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Загружаем ручные отчёты…</p>
          </div>
        ) : manualError ? (
          <div className="reports-grid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 8, textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '1rem' }}>{manualError}</p>
            <p style={{ opacity: 0.45, fontSize: '0.875rem', maxWidth: 420 }}>Нужно выполнить SQL из файла Supabase, который я добавлю в проект.</p>
          </div>
        ) : filteredManualReports.length === 0 ? (
          <div className="reports-grid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, gap: 10, textAlign: 'center' }}>
            <p style={{ fontWeight: 700, opacity: 0.68, fontSize: '1rem' }}>За эту неделю отчётов пока нет</p>
            <p style={{ opacity: 0.42, fontSize: '0.875rem', maxWidth: 420 }}>Карточки сотрудников появятся только после добавления ручного отчёта.</p>
            <button className="primary-button" type="button" onClick={() => setManualFormOpen(true)}><Plus size={17} /> Добавить отчёт</button>
          </div>
        ) : (
          <motion.div className="reports-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
            {filteredManualReports.map((report) => (
              <motion.div
                layout
                className="report-card manual-report-card"
                key={report.id}
                variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
                transition={reportCardTransition}
                whileHover={{ y: -5, scale: 1.008 }}
              >
                <div className="report-card-top">
                  <span className="report-number">{formatManualPeriod(report.periodStart, report.periodEnd)}</span>
                  <span className="report-status good">L2D {formatPercent(report.l2d)}</span>
                </div>
                <div className="report-person">
                  <Avatar name={report.employee} />
                  <div>
                    <h3>{report.employee}</h3>
                    <p>{report.channel || report.role}</p>
                  </div>
                </div>
                <div className="manual-report-metrics">
                  <div><span>Диалоги</span><strong>{report.dialogues}</strong></div>
                  <div><span>ФД</span><strong>{report.fd}</strong></div>
                  <div><span>РД</span><strong>{report.rd}</strong></div>
                  <div><span>Ответ</span><strong>{report.avgResponseTime || '—'}</strong></div>
                </div>
                <p className="report-summary">{report.notes || 'Наблюдения не добавлены.'}</p>
                <button className="manual-report-copy-button" type="button" onClick={() => setManualTextReport(report)}>
                  <Copy size={15} />
                  Сделать отчёт
                </button>
              </motion.div>
            ))}
          </motion.div>
        )
      ) : loading ? (
        <div className="reports-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Загружаем отчёты…</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="reports-grid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 8, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, opacity: 0.65, fontSize: '1rem' }}>Отчётов пока нет</p>
          <p style={{ opacity: 0.4, fontSize: '0.875rem', maxWidth: 340 }}>Отчёты появятся после первого AI-анализа диалогов.</p>
        </div>
      ) : (
        <motion.div className="reports-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
          {filteredReports.map((report) => (
            <motion.div
              layout
              layoutId={`report-employee-${report.id}`}
              className="report-card"
              key={report.id}
              role="button"
              tabIndex={0}
              variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
              transition={reportCardTransition}
              whileHover={{ y: -5, scale: 1.008 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => setSelectedEmployeeReport(report)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedEmployeeReport(report);
                }
              }}
            >
              <div className="report-card-top">
                <span className="report-number">Сводка по сотруднику</span>
                <div className="report-card-actions">
                  <span className="report-status good">{report.reportCount} проверок</span>
                  <button
                    className="report-delete-button"
                    type="button"
                    aria-label={`Удалить отчёты ${report.employee}`}
                    onClick={(event) => openDeleteReportGroup(event, report)}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="report-person">
                <Avatar name={report.employee} />
                <div>
                  <h3>{report.employee}</h3>
                  <p>Последняя проверка: {report.date || '—'}</p>
                </div>
              </div>
              <p className="report-summary">{report.summary}</p>
              <div className="report-card-recent-list">
                {report.reports.slice(0, 3).map((item) => (
                  <span key={item.id}>{item.date} · {item.dialogs} диал. · {item.score}</span>
                ))}
              </div>
              <div className="report-metrics">
                <span><b>{report.dialogs}</b> диалогов</span>
                <span><b>{report.avgScore}</b> средняя</span>
                <span><b>{report.critical}</b> критич.</span>
              </div>
              <div className="report-score-line">
                <AnimatedProgress value={report.avgScore} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {selectedEmployeeReport && (
          <EmployeeReportModal
            group={selectedEmployeeReport}
            onClose={() => setSelectedEmployeeReport(null)}
            onOpenReport={(report) => setSelectedReport(report)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedReport && (
          <ReviewReportModal
            report={selectedReport}
            layoutId={null}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteReportGroupModal
            group={deleteTarget}
            saving={deleteSaving}
            error={deleteError}
            onCancel={() => {
              if (!deleteSaving) setDeleteTarget(null);
            }}
            onConfirm={handleDeleteReportGroup}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {manualFormOpen && (
          <ManualReportFormModal
            employees={employees}
            period={week}
            organizationId={organizationId}
            onClose={() => setManualFormOpen(false)}
            onSaved={() => loadManualReports()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {manualTextReport && (
          <ManualReportTextModal
            report={manualTextReport}
            onClose={() => setManualTextReport(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
