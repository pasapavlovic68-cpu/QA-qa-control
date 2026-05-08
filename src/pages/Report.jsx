import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { demoReports } from '../data/demoData.js';
import { AnimatedProgress, Avatar } from '../components/shared.jsx';
import { reportCardTransition, ReportDetailModal } from '../components/modals.jsx';

export function Report() {
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
