import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { Avatar, AnimatedProgress } from '../components/shared.jsx';
import { employeeCardTransition, EmployeeFormModal, DeleteEmployeeModal } from '../components/modals.jsx';

function getStatusTone(status) {
  if (status === 'Улучшается') return 'success';
  if (status === 'На контроле') return 'warning';
  if (status === 'Критично') return 'danger';
  if (status === 'Без изменений') return 'neutral';
  return 'neutral';
}

function toEmployee(row) {
  const status = row.status || 'На контроле';
  return {
    id: row.id,
    name: row.name,
    role: row.role || 'Сотрудник QA',
    status,
    statusTone: getStatusTone(status),
    score: row.score ?? 0,
    dialogs: row.checks_count ?? 0,
    trend: row.trend ?? 0
  };
}

export function Employees({ setDetailOpen, setSelectedEmployee }) {
  const [employeeList, setEmployeeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '' });

  useEffect(() => {
    supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Employees] fetch error:', error);
          setLoading(false);
          return;
        }
        setEmployeeList((data ?? []).map(toEmployee));
        setLoading(false);
      });
  }, []);

  const resetForm = () => setForm({ name: '' });

  const handleAddEmployee = async (event) => {
    event.preventDefault();
    const employeeName = form.name.trim();
    if (!employeeName || saving) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('employees')
      .insert({
        name: employeeName,
        role: 'Сотрудник QA',
        status: 'На контроле',
        score: 0,
        checks_count: 0,
        trend: 0
      })
      .select()
      .single();
    setSaving(false);

    if (error) {
      console.error('[Employees] insert error:', error);
      return;
    }

    setEmployeeList((current) => [toEmployee(data), ...current]);
    resetForm();
    setAddOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      console.error('[Employees] delete error:', error);
      setDeleteTarget(null);
      return;
    }

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

      {loading ? (
        <div className="employee-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
          <p style={{ opacity: 0.45, fontSize: '0.95rem' }}>Загружаем сотрудников…</p>
        </div>
      ) : employeeList.length === 0 ? (
        <div className="employee-grid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 8, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, opacity: 0.65, fontSize: '1rem' }}>Пока нет сотрудников</p>
          <p style={{ opacity: 0.4, fontSize: '0.875rem', maxWidth: 320 }}>Добавьте первого сотрудника, чтобы начать проверку диалогов.</p>
        </div>
      ) : (
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
      )}

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
