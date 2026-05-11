import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Plus, Radio, Tag, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { Avatar, AnimatedProgress } from '../components/shared.jsx';
import { employeeCardTransition, EmployeeFormModal, DeleteEmployeeModal, StatusManagementModal, ChannelManagementModal } from '../components/modals.jsx';
import { modalMotion, modalContentVariants, modalSectionVariants, useModalScrollLock, ModalPortal } from '../components/modal.jsx';
import { useToast } from '../components/Toast.jsx';

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
    role: row.role === 'Сотрудник QA' ? 'Сотрудник' : row.role || 'Сотрудник',
    status,
    statusTone: getStatusTone(status),
    score: row.score ?? 0,
    dialogs: row.checks_count ?? 0,
    trend: row.trend ?? 0,
    channel: row.channel ?? '',
    auth_user_id: row.auth_user_id ?? null,
  };
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getStatusColor(name, statuses) {
  const found = statuses.find((s) => s.name === name);
  return found?.color ?? null;
}

function getChannelColor(name, channels) {
  const found = channels.find((channel) => channel.name === name);
  return found?.color ?? null;
}

function StatusBadge({ name, statusTone, color }) {
  if (color) {
    return (
      <span
        className="status-badge-btn"
        style={{
          background: hexToRgba(color, 0.12),
          border: `1px solid ${hexToRgba(color, 0.3)}`,
          color: color,
        }}
      >
        {name}
      </span>
    );
  }
  return (
    <span className={`status-badge-btn status ${statusTone}`}>
      {name}
    </span>
  );
}

function ChannelBadge({ name, color }) {
  if (!name) return null;
  const badgeColor = color || '#8a8fa8';
  return (
    <span
      className="channel-badge"
      style={{
        background: hexToRgba(badgeColor, 0.12),
        border: `1px solid ${hexToRgba(badgeColor, 0.3)}`,
        color: badgeColor,
      }}
    >
      <span className="channel-badge-dot" style={{ background: badgeColor }} />
      {name}
    </span>
  );
}

export function Employees({ setDetailOpen, setSelectedEmployee, employees, employeesLoading, onAdd, onDelete, organizationId }) {
  const showToast = useToast();

  // Employee add/delete
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [channelSaving, setChannelSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [channelError, setChannelError] = useState(null);
  const [form, setForm] = useState({ name: '' });

  // Status management
  const [statuses, setStatuses] = useState([]);
  const [statusMgmtOpen, setStatusMgmtOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusOverrides, setStatusOverrides] = useState({}); // {employeeId: statusName}

  // Channel management
  const [channels, setChannels] = useState([]);
  const [channelMgmtOpen, setChannelMgmtOpen] = useState(false);
  const [channelTarget, setChannelTarget] = useState(null);
  const [channelOverrides, setChannelOverrides] = useState({}); // {employeeId: channelName}

  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('employee_statuses')
      .select('id, name, color, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Employees] statuses fetch error:', error);
          return;
        }
        setStatuses(data ?? []);
      });
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('employee_channels')
      .select('id, name, color, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Employees] channels fetch error:', error);
          return;
        }
        setChannels(data ?? []);
      });
  }, [organizationId]);

  const getDisplayStatus = (employee) => statusOverrides[employee.id] ?? employee.status;
  const getDisplayChannel = (employee) => channelOverrides[employee.id] ?? employee.channel ?? '';

  const openStatusAssignment = (employee, event) => {
    event.stopPropagation();
    const statusName = getDisplayStatus(employee);
    setStatusError(null);
    setStatusTarget({
      ...employee,
      status: statusName,
      statusTone: getStatusTone(statusName),
    });
  };

  const handleStatusChange = async (employee, newStatusName) => {
    if (!employee || statusSaving) return;
    setStatusSaving(true);
    setStatusError(null);
    const payload = { status: newStatusName };
    console.log('[EmployeeStatus] update payload', { employeeId: employee.id, organizationId, ...payload });
    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', employee.id)
      .eq('organization_id', organizationId)
      .select('id, status')
      .maybeSingle();
    setStatusSaving(false);
    console.log('[EmployeeStatus] update result', { data, error });
    if (error) {
      console.error('[Employees] status update error:', error);
      setStatusError('Не удалось обновить статус');
      return;
    }
    if (!data) {
      setStatusError('Статус не сохранён. Проверьте RLS-политику UPDATE для employees.');
      return;
    }
    setStatusOverrides((prev) => ({ ...prev, [employee.id]: newStatusName }));
    setStatusTarget(null);
    showToast('Статус сотрудника обновлён');
  };

  const handleAddStatus = (newStatus) => {
    setStatuses((prev) => [...prev, newStatus]);
  };

  const handleDeleteStatus = (statusId) => {
    setStatuses((prev) => prev.filter((s) => s.id !== statusId));
  };

  const openChannelAssignment = (employee, event) => {
    event.stopPropagation();
    const channelName = getDisplayChannel(employee);
    setChannelError(null);
    setChannelTarget({
      ...employee,
      channel: channelName,
    });
  };

  const handleChannelChange = async (employee, newChannelName) => {
    if (!employee || channelSaving) return;
    setChannelSaving(true);
    setChannelError(null);
    const payload = { channel: newChannelName };
    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', employee.id)
      .eq('organization_id', organizationId)
      .select('id, channel')
      .maybeSingle();
    setChannelSaving(false);
    if (error) {
      console.error('[Employees] channel update error:', error);
      setChannelError('Не удалось обновить канал');
      return;
    }
    if (!data) {
      setChannelError('Канал не сохранён. Проверьте RLS-политику UPDATE для employees.');
      return;
    }
    setChannelOverrides((prev) => ({ ...prev, [employee.id]: newChannelName }));
    setChannelTarget(null);
    showToast('Канал сотрудника обновлён');
  };

  const handleAddChannel = (newChannel) => {
    setChannels((prev) => [...prev, newChannel]);
  };

  const handleDeleteChannel = (channelId, channelName) => {
    setChannels((prev) => prev.filter((channel) => channel.id !== channelId));
    if (channelName) {
      setChannelOverrides((prev) => {
        const next = { ...prev };
        employees.forEach((employee) => {
          if (getDisplayChannel(employee) === channelName) next[employee.id] = '';
        });
        return next;
      });
    }
  };

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
      role: 'Сотрудник',
      status: 'На контроле',
      channel: null,
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
    showToast('Сотрудник успешно добавлен');
    resetForm();
    setAddOpen(false);
  };

  const requestDelete = (employee, event) => {
    event.stopPropagation();
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
      console.error(`[Employees] delete returned 0 rows for id=${deleteTarget.id} — RLS policy likely blocking.`);
      setDeleteError('Удаление заблокировано (0 строк затронуто). Нужна RLS-политика для DELETE в таблице employees.');
      setDeleteTarget(null);
      return;
    }
    console.log(`[Employees] deleted id=${deleteTarget.id} (${deleted.length} row)`);
    onDelete(deleteTarget.id);
    showToast('Сотрудник удалён');
    setDeleteTarget(null);
  };

  const employeeGroups = employees.reduce((groups, employee) => {
    const displayChannel = getDisplayChannel(employee);
    const groupName = displayChannel || 'Без канала';
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        color: displayChannel ? getChannelColor(displayChannel, channels) : '#8a8fa8',
        employees: [],
      };
    }
    groups[groupName].employees.push(employee);
    return groups;
  }, {});

  const groupedEmployees = Object.values(employeeGroups).sort((a, b) => {
    if (a.name === 'Без канала') return 1;
    if (b.name === 'Без канала') return -1;
    return a.name.localeCompare(b.name, 'ru');
  });

  return (
    <>
      <div className="employees-page-head">
        <div>
          <span className="eyebrow">Команда на контроле</span>
          <h2>Карточки сотрудников</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button
            className="ghost-button"
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -2 }}
            onClick={() => setStatusMgmtOpen(true)}
          >
            <Tag size={15} />
            Статусы
          </motion.button>
          <motion.button
            className="ghost-button"
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -2 }}
            onClick={() => setChannelMgmtOpen(true)}
          >
            <Radio size={15} />
            Каналы
          </motion.button>
          <motion.button
            className="primary-button"
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -2 }}
            onClick={() => { setAddOpen(true); setAddError(null); }}
          >
            <Plus size={17} />
            Добавить сотрудника
          </motion.button>
        </div>
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
        <motion.div className="employee-channel-groups" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
          {groupedEmployees.map((group) => (
            <section className="employee-channel-group" key={group.name}>
              <div className="employee-channel-heading">
                <span className="employee-channel-dot" style={{ background: group.color }} />
                <h3>{group.name}</h3>
                <span>{group.employees.length}</span>
              </div>
              <div className="employee-grid">
                <AnimatePresence mode="popLayout">
                  {group.employees.map((employee) => {
                    const displayStatus = getDisplayStatus(employee);
                    const displayChannel = getDisplayChannel(employee);
                    const customColor = getStatusColor(displayStatus, statuses);
                    const channelColor = getChannelColor(displayChannel, channels);
                    const fallbackTone = getStatusTone(displayStatus);
                    const displayEmployee = { ...employee, status: displayStatus, statusTone: fallbackTone, channel: displayChannel };

                    return (
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
                          setSelectedEmployee(displayEmployee);
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
                            <StatusBadge
                              name={displayStatus}
                              statusTone={fallbackTone}
                              color={customColor}
                            />
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
                        <div className="employee-badge-row">
                          <ChannelBadge name={displayChannel} color={channelColor} />
                        </div>
                        <div className="employee-assignment-actions">
                          <motion.button
                            type="button"
                            className="employee-status-button"
                            whileTap={{ scale: 0.97 }}
                            onClick={(event) => openStatusAssignment(displayEmployee, event)}
                          >
                            Изменить статус
                          </motion.button>
                          <motion.button
                            type="button"
                            className="employee-status-button"
                            whileTap={{ scale: 0.97 }}
                            onClick={(event) => openChannelAssignment(displayEmployee, event)}
                          >
                            Изменить канал
                          </motion.button>
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
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          ))}
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

      <AnimatePresence>
        {statusTarget && (
          <EmployeeStatusAssignModal
            employee={statusTarget}
            statuses={statuses}
            saving={statusSaving}
            error={statusError}
            onClose={() => {
              setStatusTarget(null);
              setStatusError(null);
            }}
            onManage={() => {
              setStatusTarget(null);
              setStatusError(null);
              setStatusMgmtOpen(true);
            }}
            onAssign={(statusName) => handleStatusChange(statusTarget, statusName)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {channelTarget && (
          <EmployeeChannelAssignModal
            employee={channelTarget}
            channels={channels}
            saving={channelSaving}
            error={channelError}
            onClose={() => {
              setChannelTarget(null);
              setChannelError(null);
            }}
            onManage={() => {
              setChannelTarget(null);
              setChannelError(null);
              setChannelMgmtOpen(true);
            }}
            onAssign={(channelName) => handleChannelChange(channelTarget, channelName)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {statusMgmtOpen && (
          <StatusManagementModal
            statuses={statuses}
            organizationId={organizationId}
            onClose={() => setStatusMgmtOpen(false)}
            onAdd={handleAddStatus}
            onDelete={handleDeleteStatus}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {channelMgmtOpen && (
          <ChannelManagementModal
            channels={channels}
            organizationId={organizationId}
            onClose={() => setChannelMgmtOpen(false)}
            onAdd={handleAddChannel}
            onDelete={handleDeleteChannel}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function EmployeeStatusAssignModal({ employee, statuses, saving, error, onClose, onManage, onAssign }) {
  const currentColor = getStatusColor(employee.status, statuses);

  useModalScrollLock();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop status-popover-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="status-popover"
        role="dialog"
        aria-modal="true"
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        exit={modalMotion.exit}
        transition={modalMotion.transition}
        onClick={(event) => event.stopPropagation()}
      >
        <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
          <motion.div className="status-popover-title" variants={modalSectionVariants}>
            <div className="status-modal-person">
              <div className="status-modal-avatar">
                <Avatar name={employee.name} />
              </div>
              <div className="status-modal-heading">
                <span className="eyebrow">Статус сотрудника</span>
                <h3>{employee.name}</h3>
                <p>Сотрудник</p>
              </div>
            </div>
            <button className="icon-button" type="button" onClick={onClose}><X size={16} /></button>
          </motion.div>

          <motion.div className="status-current status-current--hero" variants={modalSectionVariants}>
            <span>Текущий статус</span>
            <StatusBadge name={employee.status} statusTone={employee.statusTone} color={currentColor} />
          </motion.div>

          <motion.div variants={modalSectionVariants}>
            {statuses.length === 0 ? (
              <div className="status-empty">
                <strong>Сначала создайте статус</strong>
                <p>После создания статусы появятся здесь, и их можно будет назначать сотруднику одним кликом.</p>
                <button className="ghost-button" type="button" onClick={onManage}>Управление статусами</button>
              </div>
            ) : (
              <div className="status-options-panel">
                <span className="status-options-label">Выберите новый статус</span>
                <div className="status-choice-list">
                  {statuses.map((status) => {
                    const selected = status.name === employee.status;
                    return (
                      <button
                        key={status.id}
                        type="button"
                        className={`status-choice ${selected ? 'selected' : ''}`}
                        disabled={saving}
                        onClick={() => onAssign(status.name)}
                      >
                        <span className="status-choice-main">
                          <span className="status-choice-dot" style={{ background: status.color }} />
                          <span>{status.name}</span>
                        </span>
                        <span className="status-choice-check" aria-hidden="true">
                          {selected && <Check size={16} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {error && <motion.p className="status-error" variants={modalSectionVariants}>{error}</motion.p>}
          <motion.p className="status-save-hint" variants={modalSectionVariants}>Изменение сохранится сразу</motion.p>
        </motion.div>
      </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

function EmployeeChannelAssignModal({ employee, channels, saving, error, onClose, onManage, onAssign }) {
  const currentColor = getChannelColor(employee.channel, channels);

  useModalScrollLock();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop status-popover-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="status-popover"
        role="dialog"
        aria-modal="true"
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        exit={modalMotion.exit}
        transition={modalMotion.transition}
        onClick={(event) => event.stopPropagation()}
      >
        <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
          <motion.div className="status-popover-title" variants={modalSectionVariants}>
            <div className="status-modal-person">
              <div className="status-modal-avatar">
                <Avatar name={employee.name} />
              </div>
              <div className="status-modal-heading">
                <span className="eyebrow">Канал сотрудника</span>
                <h3>{employee.name}</h3>
                <p>Сотрудник</p>
              </div>
            </div>
            <button className="icon-button" type="button" onClick={onClose}><X size={16} /></button>
          </motion.div>

          <motion.div className="status-current status-current--hero" variants={modalSectionVariants}>
            <span>Текущий канал</span>
            {employee.channel ? (
              <ChannelBadge name={employee.channel} color={currentColor} />
            ) : (
              <ChannelBadge name="Без канала" color="#8a8fa8" />
            )}
          </motion.div>

          <motion.div variants={modalSectionVariants}>
            {channels.length === 0 ? (
              <div className="status-empty">
                <strong>Сначала создайте канал</strong>
                <p>После создания каналы появятся здесь, и их можно будет назначать сотруднику одним кликом.</p>
                <button className="ghost-button" type="button" onClick={onManage}>Управление каналами</button>
              </div>
            ) : (
              <div className="status-options-panel">
                <span className="status-options-label">Выберите новый канал</span>
                <div className="status-choice-list">
                  {channels.map((channel) => {
                    const selected = channel.name === employee.channel;
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        className={`status-choice ${selected ? 'selected' : ''}`}
                        disabled={saving}
                        onClick={() => onAssign(channel.name)}
                      >
                        <span className="status-choice-main">
                          <span className="status-choice-dot" style={{ background: channel.color }} />
                          <span>{channel.name}</span>
                        </span>
                        <span className="status-choice-check" aria-hidden="true">
                          {selected && <Check size={16} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {error && <motion.p className="status-error" variants={modalSectionVariants}>{error}</motion.p>}
          <motion.p className="status-save-hint" variants={modalSectionVariants}>Изменение сохранится сразу</motion.p>
        </motion.div>
      </motion.div>
      </motion.div>
    </ModalPortal>
  );
}
