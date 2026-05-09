import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { supabase, fetchWithTimeout } from '../lib/supabase.js';
import { AnimatedProgress, Avatar } from '../components/shared.jsx';
import { reportCardTransition, ReportDetailModal } from '../components/modals.jsx';

function toReport(row) {
  return {
    id: row.id,
    employee: '',
    employeeId: row.employee_id,
    score: row.score ?? 0,
    title: row.title || 'Отчёт',
    summary: row.management_summary || '',
    date: row.created_at ? new Date(row.created_at).toLocaleDateString('ru-RU') : '',
    status: 'Готово',
    tone: 'success',
    dialogs: 0,
    critical: 0
  };
}

export function Report() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchWithTimeout(
      supabase
        .from('reports')
        .select('id, employee_id, score, title, management_summary, created_at')
        .order('created_at', { ascending: false }),
      'Report'
    ).then(({ data, error }) => {
      if (error) { setLoading(false); return; }
      setReports((data ?? []).map(toReport));
      setLoading(false);
    });
  }, []);

  const filteredReports = reports.filter((report) => {
    const searchValue = `${report.title} ${report.summary}`.toLowerCase();
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
                <span className="report-number">{report.title}</span>
                <span className={`report-status ${report.tone}`}>{report.status}</span>
              </div>
              <div className="report-person">
                <Avatar name={report.employee || '?'} />
                <div>
                  <h3>{report.employee || 'Сотрудник'}</h3>
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
          <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
