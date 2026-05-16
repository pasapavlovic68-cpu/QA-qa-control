import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Search, Trash2, X } from 'lucide-react';
import { downloadCheckPdf } from '../lib/generatePdf.js';
import { supabase, fetchWithTimeout } from '../lib/supabase.js';
import { useToast } from '../components/Toast.jsx';
import { AnimatedProgress, Avatar, ScrollReveal } from '../components/shared.jsx';
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
      const allSorted = [...group.reports].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      const allAggregates = allSorted.filter((r) => r.title === '__aggregate__');
      const sortedReports = allSorted.filter((r) => r.title !== '__aggregate__');
      const reportCount = sortedReports.length;
      const dialogs = sortedReports.reduce((sum, report) => sum + (report.dialogs || 0), 0);
      const avgScore = reportCount
        ? Math.round(sortedReports.reduce((sum, report) => sum + (report.score || 0), 0) / reportCount)
        : 0;
      const mistakes = sortedReports.flatMap((report) => report.mistakes ?? []);
      const critical = mistakes.filter((item) => item.severity === 'critical' || item.severity === 'high').length;
      const latest = sortedReports[0];
      const mistakeCounts = mistakes.reduce((acc, m) => {
        const key = m.title || m.description || 'Замечание';
        if (!acc[key]) acc[key] = { title: key, severity: m.severity, count: 0 };
        if (severityRank(m.severity) > severityRank(acc[key].severity)) acc[key].severity = m.severity;
        acc[key].count += 1;
        return acc;
      }, {});
      const topMistakes = Object.values(mistakeCounts)
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count)
        .slice(0, 5);
      const recommendations = sortedReports.flatMap((report) => report.recommendations ?? []).slice(0, 4);

      // Group individual reports by checkId → date folders
      const byCheckId = {};
      sortedReports.forEach((r) => {
        const cid = r.checkId || 'unknown';
        if (!byCheckId[cid]) byCheckId[cid] = [];
        byCheckId[cid].push(r);
      });
      const checkGroups = Object.entries(byCheckId).map(([checkId, cReports]) => {
        const cAgg = allAggregates.find((a) => a.checkId === checkId) ?? null;
        const cAvg = cReports.length
          ? Math.round(cReports.reduce((s, r) => s + (r.score || 0), 0) / cReports.length)
          : 0;
        const cCritical = cReports.flatMap((r) => r.mistakes ?? []).filter((m) => m.severity === 'critical' || m.severity === 'high').length;
        const cMistakeCounts = cReports.flatMap((r) => r.mistakes ?? []).reduce((acc, m) => {
          const key = m.title || 'Замечание';
          if (!acc[key]) acc[key] = { title: key, severity: m.severity, count: 0 };
          if (severityRank(m.severity) > severityRank(acc[key].severity)) acc[key].severity = m.severity;
          acc[key].count += 1;
          return acc;
        }, {});
        const cTopMistakes = Object.values(cMistakeCounts)
          .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count)
          .slice(0, 6);
        return {
          checkId,
          date: cReports[0]?.createdAt || '',
          reports: cReports,
          aggregateReport: cAgg,
          avgScore: cAvg,
          count: cReports.length,
          critical: cCritical,
          topMistakes: cTopMistakes,
        };
      }).sort((a, b) => new Date(b.date) - new Date(a.date));

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
        aggregateReport: allAggregates[0] ?? null,
        checkGroups,
      };
    })
    .sort((a, b) => new Date(b.latest?.createdAt || b.latest?.date) - new Date(a.latest?.createdAt || a.latest?.date));
}

function severityColor(s) {
  return s === 'critical' || s === 'high' ? 'var(--danger)' : s === 'medium' ? 'var(--warning)' : 'var(--accent)';
}
function severityBg(s) {
  return s === 'critical' || s === 'high' ? 'rgba(190,60,68,0.07)' : s === 'medium' ? 'rgba(185,120,18,0.07)' : 'rgba(119,101,227,0.06)';
}
function severityBorder(s) {
  return s === 'critical' || s === 'high' ? 'rgba(190,60,68,0.18)' : s === 'medium' ? 'rgba(185,120,18,0.18)' : 'rgba(119,101,227,0.14)';
}
function scoreCol(s) {
  return s >= 85 ? 'var(--success)' : s >= 70 ? 'var(--warning)' : 'var(--danger)';
}
function pluralDialogs(n) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} диалог`;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return `${n} диалога`;
  return `${n} диалогов`;
}
function formatCheckDate(dateStr) {
  if (!dateStr) return 'Без даты';
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ExampleCard({ ex }) {
  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--line)', overflow: 'hidden' }}>
      {ex.context && <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--line)', background: 'rgba(119,101,227,0.04)' }}>{ex.context}</div>}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 }}>КЛИЕНТ</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text)', fontStyle: 'italic' }}>«{ex.client_message}»</div>
        {ex.client_message_ru && ex.client_message_ru !== ex.client_message && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 3 }}>Перевод: {ex.client_message_ru}</div>}
      </div>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'rgba(190,60,68,0.03)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', marginBottom: 3 }}>КАК ОТВЕТИЛА</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text)', fontStyle: 'italic' }}>«{ex.employee_response}»</div>
        {ex.employee_response_ru && ex.employee_response_ru !== ex.employee_response && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 3 }}>Перевод: {ex.employee_response_ru}</div>}
      </div>
      <div style={{ padding: '10px 14px', background: 'rgba(119,101,227,0.04)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 3 }}>КАК НАДО</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{ex.ideal_response}</div>
        {ex.why && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>{ex.why}</div>}
      </div>
    </div>
  );
}

function CheckGroupContent({ checkGroup, onOpenReport }) {
  const aggText = checkGroup.aggregateReport?.summary || checkGroup.aggregateReport?.management_summary || '';
  const aggExamples = (checkGroup.aggregateReport?.evidence ?? []).filter((e) => e.client_message);
  const topMistakes = checkGroup.topMistakes ?? [];

  return (
    <>
      {aggText && (
        <div className="employee-report-section">
          <span className="employee-report-section-label">Общий вывод</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {aggText.split(/\n\n+/).filter(Boolean).map((block, bi) => {
              const isImprove = block.trimStart().startsWith('Что бы я усилил');
              const lines = block.split(/\n/).filter(Boolean);
              return (
                <div key={bi} style={isImprove ? { background: 'rgba(119,101,227,0.05)', border: '1px solid rgba(119,101,227,0.12)', borderRadius: 14, padding: '12px 16px' } : undefined}>
                  {lines.map((line, li) => (
                    <p key={li} style={{ margin: li === 0 ? 0 : '4px 0 0', fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--text)', fontWeight: li === 0 && isImprove ? 600 : 400 }}>{line}</p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {aggExamples.length > 0 && (
        <div className="employee-report-section">
          <span className="employee-report-section-label">Примеры из диалогов</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {aggExamples.slice(0, 3).map((ex, i) => <ExampleCard key={i} ex={ex} />)}
          </div>
        </div>
      )}

      {topMistakes.length > 0 && (
        <div className="employee-report-section">
          <span className="employee-report-section-label">Частые ошибки</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topMistakes.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: severityBg(m.severity), border: `1px solid ${severityBorder(m.severity)}` }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{m.title}</span>
                {m.count > 1 && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: severityColor(m.severity), padding: '2px 9px', borderRadius: 20, flexShrink: 0, marginLeft: 8, background: 'rgba(0,0,0,0.05)' }}>×{m.count}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="employee-report-section">
        <span className="employee-report-section-label">Диалоги ({checkGroup.count})</span>
        <div className="employee-report-list">
          {checkGroup.reports.map((report) => (
            <button key={report.id} className="employee-report-row" type="button" onClick={() => onOpenReport(report)}>
              <span>
                <strong>{report.title}</strong>
                <small>{report.date}</small>
              </span>
              <b style={{ color: scoreCol(report.score) }}>{report.score}</b>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function EmployeeReportModal({ group, onClose, onOpenReport }) {
  useModalScrollLock();
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [downloading, setDownloading] = useState(false);

  if (!group) return null;

  const checkGroups = group.checkGroups ?? [];

  const handleDownload = async () => {
    if (!selectedCheck || downloading) return;
    setDownloading(true);
    try {
      await downloadCheckPdf(selectedCheck, group.employee);
    } finally {
      setDownloading(false);
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
          layoutId={`report-employee-${group.id}`}
          className="modal-shell modal-shell--large employee-report-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          transition={reportCardTransition}
          style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 64px)' }}
        >
          <motion.div
            variants={modalContentVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', flex: 1 }}
          >
            {/* Header */}
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {selectedCheck && (
                  <button className="icon-button" type="button" onClick={() => setSelectedCheck(null)} title="Назад">
                    <ChevronLeft size={18} />
                  </button>
                )}
                <div className="employee-report-title">
                  <Avatar name={group.employee} />
                  <div>
                    <span className="eyebrow">Отчёты сотрудника</span>
                    <h2>{group.employee}</h2>
                    <p>{selectedCheck ? formatCheckDate(selectedCheck.date) : `${checkGroups.length} проверок`}</p>
                  </div>
                </div>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            {selectedCheck ? (
              <CheckGroupContent checkGroup={selectedCheck} onOpenReport={onOpenReport} />
            ) : (
              <>
                {/* Stats */}
                <motion.div className="employee-report-summary-grid" variants={modalSectionVariants}>
                  <div><span>Средняя оценка</span><strong>{group.avgScore}</strong></div>
                  <div><span>Проверок</span><strong>{checkGroups.length}</strong></div>
                  <div><span>Критично</span><strong>{group.critical}</strong></div>
                </motion.div>

                {/* Date folders */}
                <motion.div className="employee-report-section" variants={modalSectionVariants}>
                  <span className="employee-report-section-label">История проверок</span>
                  <div className="employee-report-list">
                    {checkGroups.map((cg) => (
                      <button
                        key={cg.checkId}
                        className="employee-report-row"
                        type="button"
                        onClick={() => setSelectedCheck(cg)}
                      >
                        <span>
                          <strong>{formatCheckDate(cg.date)}</strong>
                          <small>{pluralDialogs(cg.count)}</small>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <b style={{ color: scoreCol(cg.avgScore) }}>{cg.avgScore}</b>
                          <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}

            {/* Bottom bar */}
            <motion.div
              variants={modalSectionVariants}
              style={{ padding: '12px 0 4px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}
            >
              {selectedCheck && (
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
              )}
              <motion.button
                className="ghost-button"
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={selectedCheck ? () => setSelectedCheck(null) : onClose}
                style={{ flex: 1 }}
              >
                {selectedCheck ? 'Назад' : 'Закрыть'}
              </motion.button>
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
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadReports({ showLoader: true }).catch((error) => {
      console.error('[Report] load error:', error);
      setLoading(false);
    });
  }, [organizationId]);

  const employeeReports = buildEmployeeReports(reports);

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
          <span className="eyebrow">История проверок</span>
          <h2>Сформированные отчёты</h2>
        </div>
        <label className="report-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти отчёт, сотрудника или статус" />
        </label>
      </div>

      {loading ? (
        <div className="reports-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Загружаем отчёты…</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="reports-grid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 8, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, opacity: 0.65, fontSize: '1rem' }}>Отчётов пока нет</p>
          <p style={{ opacity: 0.4, fontSize: '0.875rem', maxWidth: 340 }}>Отчёты появятся после первого AI-анализа диалогов.</p>
        </div>
      ) : (
        <div className="reports-grid">
          {filteredReports.map((report) => (
            <ScrollReveal key={report.id}>
            <motion.div
              layout
              layoutId={`report-employee-${report.id}`}
              className="report-card"
              role="button"
              tabIndex={0}
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
              <div className="report-metrics">
                <span><b>{report.avgScore}</b> средняя</span>
                <span><b>{report.critical}</b> критич.</span>
              </div>
              <div className="report-score-line">
                <AnimatedProgress value={report.avgScore} />
              </div>
            </motion.div>
            </ScrollReveal>
          ))}
        </div>
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
    </>
  );
}
