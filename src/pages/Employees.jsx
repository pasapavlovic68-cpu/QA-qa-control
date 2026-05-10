import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';
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
    trend: row.trend ?? 0,
    auth_user_id: row.auth_user_id ?? null,
  };
}

export function Employees({ setDetailOpen, setSelectedEmployee, employees, employeesLoading, onAdd, onDelete, organizationId }) {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [form, setForm] = useState({ name: '' });

  const resetForm = () => setForm({ name: '' });

  const handleAddEmployee = async (event) => {
    event.preventDefault();
    const employeeName = form.name.trim();
    if (!employeeName || saving) return;

    if (!organizationId) {
      setAddError('Организация не загружена. Повторите попытку.');
      return;
    }

    setSaving(true);
    setAddError(null);

    const payload = {
      name: employeeName,
      role: 'Сотрудник QA',
      status: 'На контроле',
      score: 0,
      checks_count: 0,
      trend: 0,
      organization_id: organizationId
    };
    const { data, error } = await supabase
      .from('employees')
      .insert(payload)
      .select()
      .single();
    setSaving(false);

    if (error) {
      console.error('[Employees] insert error:', error);
      setAddError(`Ошибка [${error.code || 'network'}]: ${error.message}`);
      return;
    }

    onAdd(toEmployee(data));
    resetForm();
    setAddOpen(false);
  };

  const requestDelete = (employee, event) => {
    event.stopPropagation();

    // Block deletion of authenticated users (app access accounts)
    if (employee.auth_user_id) {
      console.warn(`[Employees] blocked delete: employee id=${employee.id} has auth_user_id — system account`);
      setDeleteError('Нельзя удалить пользователя с доступом к кабинету.');
      return;
    }

    setDeleteError(null);
    setDeleteTarget(employee);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    // Double-check: should not happen if requestDelete works, but guard anyway
    if (deleteTarget.auth_user_id) {
      console.warn(`[Employees] confirmDelete blocked: auth_user_id present on id=${deleteTarget.id}`);
      setDeleteError('Нельзя удалить пользователя с доступом к кабинету.');
      setDeleteTarget(null);
      return;
    }

    if (!organizationId) {
      console.error('[Employees] organizationId missing, aborting delete');
      setDeleteTarget(null);
      return;
    }

    console.log(`[Employees] deleting employee id=${deleteTarget.id} org=${organizationId}`);

    // Use .select('id') to detect silent RLS failure (RLS block returns data:[] with no error)
    const { data: deleted, error } = await supabase
      .from('employees')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('organization_id', organizationId)
      .select('id');

    if (error) {
      console.error(`[Employees] delete error for id=${deleteTarget.id}:`, error);
      setDeleteError(`Ошибка удаления: ${error.message}`);
      setDeleteTarget(null);
      return;
    }

    if (!deleted || deleted.length === 0) {
      // Supabase returned no error but also deleted nothing — classic RLS silent block
      console.error(`[Employees] delete returned 0 rows for id=${deleteTarget.id} — RLS policy likely blocking. See RLS note.`);
      setDeleteError('Удаление заблокировано (0 строк затронуто). Нужна RLS-политика для DELETE в таблице employees.');
      setDeleteTarget(null);
      return;
    }

    console.log(`[Employees] deleted id=${deleteTarget.id} (${deleted.length} row)`);
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="employees-page-head">
        <div>
          <span className="eyebrow">Команда на контроле</span>
          <h2>Карточки сотрудников</h2>
        </div>
        <motion.button className="primary-button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={() => { setAddOpen(true); setAddError(null); }}>
          <Plus size={17} />
          Добавить сотрудника
        </motion.button>
      </div>

      {/* Inline delete/block error banner */}
      <AnimatePresence>
        {deleteError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 16px',
              marginBottom: 16,
              borderRadius: 14,
              background: 'rgba(190,60,68,0.07)',
              border: '1px solid rgba(190,60,68,0.18)',
              fontSize: 13,
              color: 'var(--danger)',
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{deleteError}</span>
            <button
              type="button"
              onClick={() => setDeleteError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2, display: 'flex' }}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {employeesLoading ? (
        <div className="employee-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
          <p style={{ opacity: 0.45, fontSize: '0.95rem' }}>Загружаем сотрудников…</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="employee-grid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 8, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, opacity: 0.65, fontSize: '1rem' }}>Пока нет сотрудников</p>
          <p style={{ opacity: 0.4, fontSize: '0.875rem', maxWidth: 320 }}>Добавьте первого сотрудника, чтобы начать проверку диалогов.</p>
        </div>
      ) : (
        <motion.div className="employee-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
          <AnimatePresence mode="popLayout">
            {employees.map((employee) => (
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
                      onClick={(event) => requestDelete(employee, event)}
                    >
                      <Trash2 size={15} />
                    </motion.button>
                  </div>
                </div>
                <div className="score-line">
                  <div>
                    <strong>{employee.score}</strong>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 2, fontWeight: 500, letterSpacing: 0.2 }}>/ 100</span>
                  </div>
                  <AnimatedProgress value={employee.score} />
                </div>
                <div className="employee-meta">
                  <span><b style={{ color: 'var(--text)', marginRight: 3 }}>{employee.dialogs}</b>диалогов</span>
                  <span style={{ color: employee.trend > 0 ? 'var(--success)' : employee.trend < 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: 600 }}>
                    {employee.trend > 0 ? '+' : ''}{employee.trend}
                  </span>
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
            saving={saving}
            error={addError}
            onClose={() => {
              resetForm();
              setAddError(null);
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
