import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { supabase, fetchWithTimeout } from '../lib/supabase.js';
import { AnimatedProgress, Avatar } from '../components/shared.jsx';
import { reportCardTransition, ReviewReportModal } from '../components/modals.jsx';

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

export function Report({ organizationId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const filteredReports = reports.filter((report) => {
    const searchValue = `${report.title} ${report.employee} ${report.summary}`.toLowerCase();
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
              layoutId={`report-${report.id}`}
              className="report-card"
              key={report.id}
              variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
              transition={reportCardTransition}
              whileHover={{ y: -5, scale: 1.008 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => setSelectedReport(report)}
            >
              <div className="report-card-top">
                <span className="report-number">{report.title}</span>
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
      )}

      <AnimatePresence>
        {selectedReport && (
          <ReviewReportModal
            report={selectedReport}
            layoutId={`report-${selectedReport.id}`}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
