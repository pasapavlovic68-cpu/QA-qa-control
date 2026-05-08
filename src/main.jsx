import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AnimatePresence,
  LayoutGroup,
  motion
} from 'framer-motion';
import './styles.css';
import { employees } from './data/demoData.js';
import { tabs, Sidebar, Topbar } from './components/layout.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Employees } from './pages/Employees.jsx';
import { Review } from './pages/Review.jsx';
import { Report } from './pages/Report.jsx';
import { Rules } from './pages/Rules.jsx';
import { EmployeeDrawer } from './components/modals.jsx';

function App() {
  const [active, setActive] = useState('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [analysis, setAnalysis] = useState('idle');

  const currentTitle = tabs.find((tab) => tab.id === active)?.label ?? 'Главная';

  return (
    <LayoutGroup>
      <div className="app-shell">
        <Sidebar active={active} setActive={setActive} />
        <main className="workspace">
          <Topbar title={currentTitle} onNewReview={() => setActive('review')} />
          <AnimatePresence mode="wait">
            <motion.section
              key={active}
              className="page"
              initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              {active === 'dashboard' && <Dashboard setActive={setActive} setDetailOpen={setDetailOpen} setSelectedEmployee={setSelectedEmployee} />}
              {active === 'employees' && <Employees setDetailOpen={setDetailOpen} setSelectedEmployee={setSelectedEmployee} />}
              {active === 'review' && <Review analysis={analysis} setAnalysis={setAnalysis} />}
              {active === 'report' && <Report />}
              {active === 'rules' && <Rules />}
            </motion.section>
          </AnimatePresence>
        </main>
        <AnimatePresence>
          {detailOpen && (
            <EmployeeDrawer
              employee={selectedEmployee}
              onClose={() => setDetailOpen(false)}
              onNewReview={() => {
                setDetailOpen(false);
                setActive('review');
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}


createRoot(document.getElementById('root')).render(<App />);
