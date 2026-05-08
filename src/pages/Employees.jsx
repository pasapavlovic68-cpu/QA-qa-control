import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { employees } from '../data/demoData.js';
import { Avatar, AnimatedProgress } from '../components/shared.jsx';
import { employeeCardTransition, EmployeeFormModal, DeleteEmployeeModal } from '../components/modals.jsx';

export function Employees({ setDetailOpen, setSelectedEmployee }) {
  const [employeeList, setEmployeeList] = useState(employees);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({
    name: ''
  });

  const resetForm = () => {
    setForm({
      name: ''
    });
  };

  const handleAddEmployee = (event) => {
    event.preventDefault();
    const employeeName = form.name.trim();
    if (!employeeName) return;

    const newEmployee = {
      id: Date.now(),
      name: employeeName,
      role: 'Сотрудник QA',
      score: 0,
      dialogs: 0,
      issue: 'Зона контроля будет рассчитана после проверок',
      status: 'На контроле',
      statusTone: 'warning',
      trend: '0%'
    };

    setEmployeeList((current) => [newEmployee, ...current]);
    resetForm();
    setAddOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setEmployeeList((current) => current.filter((employee) => employee.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="employees-page-head">
        <div>
          <span className="eyebrow">Команда на контроле</span>
          <h2>Карточки сотрудников</h2>
        </div>
        <motion.button className="primary-button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={() => setAddOpen(true)}>
          <Plus size={17} />
          Добавить сотрудника
        </motion.button>
      </div>

      <motion.div className="employee-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
        <AnimatePresence mode="popLayout">
          {employeeList.map((employee) => (
            <motion.article
              layout
              layoutId={`employee-${employee.id}`}
              className="employee-card"
              key={employee.id}
              variants={{ hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={employeeCardTransition}
              whileHover={{ y: -5, scale: 1.008 }}
              whileTap={{ scale: 0.985 }}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedEmployee(employee);
                setDetailOpen(true);
              }}
            >
              <div className="employee-head">
                <div className="employee-identity">
                  <Avatar name={employee.name} />
                  <div className="employee-title">
                    <h3>{employee.name}</h3>
                    <p>{employee.role}</p>
                  </div>
                </div>
                <div className="employee-head-actions">
                  <span className={`status ${employee.statusTone}`}>{employee.status}</span>
                  <motion.button
                    className="employee-delete"
                    aria-label={`Удалить сотрудника ${employee.name}`}
                    whileTap={{ scale: 0.9 }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(employee);
                    }}
                  >
                    <Trash2 size={15} />
                  </motion.button>
                </div>
              </div>
              <div className="score-line">
                <strong>{employee.score}</strong>
                <AnimatedProgress value={employee.score} />
              </div>
              <div className="employee-meta">
                <span>{employee.dialogs} диалогов</span>
                <span>{employee.trend}</span>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {addOpen && (
          <EmployeeFormModal
            form={form}
            setForm={setForm}
            onClose={() => {
              resetForm();
              setAddOpen(false);
            }}
            onSubmit={handleAddEmployee}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteEmployeeModal
            employee={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </>
  );
}
