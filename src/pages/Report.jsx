import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { supabase, fetchWithTimeout } from '../lib/supabase.js';
import { AnimatedProgress, Avatar } from '../components/shared.jsx';
import { reportCardTransition, ReviewReportModal } from '../components/modals.jsx';
import { ModalPortal, modalContentVariants, modalSectionVariants, useModalScrollLock } from '../components/modal.jsx';

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

export function Report({ organizationId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeReport, setSelectedEmployeeReport] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    console.log('[PostAnalysisDataFlow] Report: fetching reports, employees, qa_checks');
    Promise.all([
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
    ]).then(([reportsResult, employeesResult, checksResult]) => {
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
    });
  }, [organizationId]);

  const employeeReports = buildEmployeeReports(reports);

  const filteredReports = employeeReports.filter((group) => {
    const reportText = group.reports.map((report) => `${report.title} ${report.summary}`).join(' ');
    const searchValue = `${group.employee} ${group.summary} ${reportText}`.toLowerCase();
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
        <motion.div className="reports-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
          {filteredReports.map((report) => (
            <motion.button
              layout
              layoutId={`report-employee-${report.id}`}
              className="report-card"
              key={report.id}
              variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
              transition={reportCardTransition}
              whileHover={{ y: -5, scale: 1.008 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => setSelectedEmployeeReport(report)}
            >
              <div className="report-card-top">
                <span className="report-number">Сводка по сотруднику</span>
                <span className="report-status good">{report.reportCount} проверок</span>
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
            </motion.button>
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
    </>
  );
}
