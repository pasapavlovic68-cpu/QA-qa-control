import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Pencil, Plus, Radio, Tag, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { Avatar } from '../components/shared.jsx';
import { EmployeeFormModal, DeleteEmployeeModal, StatusManagementModal, ChannelManagementModal } from '../components/modals.jsx';
import { modalMotion, modalContentVariants, modalSectionVariants, useModalScrollLock, ModalPortal } from '../components/modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { runModalSuccessFlow } from '../lib/modalSuccess.js';

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

const SCHEDULE_STATUSES = {
  work: { label: 'Работает', short: 'Р', color: '#198a62' },
  off: { label: 'Выходной', short: 'В', color: '#8a8fa8' },
  vacation: { label: 'Отпуск', short: 'О', color: '#d4920a' },
  sick: { label: 'Больничный', short: 'Б', color: '#be3c44' },
};

const UNSET_SCHEDULE_STATUS = { label: 'Не назначено', short: '—', color: '#8a8fa8' };
const DEFAULT_SHIFT_START = '10:00';
const DEFAULT_SHIFT_END = '19:00';
const SCHEDULE_SELECTOR_HEIGHT = 330;

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMoscowDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function getMonthDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
}

function getMonthLabel() {
  return new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function formatScheduleDay(date) {
  return date.toLocaleDateString('ru-RU', { day: '2-digit' });
}

function formatScheduleWeekday(date) {
  return date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '');
}

function normalizeScheduleTime(value) {
  if (!value || typeof value !== 'string') return '';
  return value.slice(0, 5);
}

function createScheduleEntry(row) {
  if (!row?.status) return null;
  return {
    status: row.status,
    start_time: normalizeScheduleTime(row.start_time),
    end_time: normalizeScheduleTime(row.end_time),
  };
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

function TodayScheduleBadge({ entry }) {
  const status = typeof entry === 'string' ? entry : entry?.status;
  const startTime = normalizeScheduleTime(entry?.start_time);
  const endTime = normalizeScheduleTime(entry?.end_time);
  const hasWorkTime = status === 'work' && startTime && endTime;
  const schedule = SCHEDULE_STATUSES[status] ?? UNSET_SCHEDULE_STATUS;

  return (
    <span
      className={`today-schedule-badge ${status ? 'filled' : 'unset'} ${hasWorkTime ? 'has-time' : ''}`}
      style={{
        '--today-schedule-color': schedule.color,
        '--today-schedule-bg': hexToRgba(schedule.color, status ? 0.12 : 0.08),
        '--today-schedule-border': hexToRgba(schedule.color, status ? 0.3 : 0.18),
      }}
    >
      <span className="today-schedule-dot" />
      <span className="today-schedule-label">{schedule.label}</span>
      {hasWorkTime && (
        <>
          <span className="today-schedule-divider" />
          <span className="today-schedule-time">{startTime}-{endTime}</span>
        </>
      )}
    </span>
  );
}

export function Employees({ setDetailOpen, setSelectedEmployee, employees, employeesLoading, onAdd, onDelete, organizationId }) {
  const showToast = useToast();

  // Employee add/delete
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
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
  const [channelOverrides, setChannelOverrides] = useState({}); // {employeeId: "Chan1,Chan2"}
  const [todaySchedule, setTodaySchedule] = useState({});

  // Name editing
  const [nameOverrides, setNameOverrides] = useState({}); // {employeeId: newName}
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const todayDateKey = getMoscowDateKey();

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

  useEffect(() => {
    if (!organizationId) {
      setTodaySchedule({});
      return;
    }
    supabase
      .from('employee_schedule')
      .select('employee_id, status, start_time, end_time')
      .eq('organization_id', organizationId)
      .eq('work_date', todayDateKey)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Employees] today schedule fetch error:', error);
          if (error.code === '42703') {
            supabase
              .from('employee_schedule')
              .select('employee_id, status')
              .eq('organization_id', organizationId)
              .eq('work_date', todayDateKey)
              .then(({ data: fallbackData, error: fallbackError }) => {
                if (fallbackError) {
                  console.error('[Employees] today schedule fallback fetch error:', fallbackError);
                  return;
                }
                const fallbackSchedule = {};
                (fallbackData ?? []).forEach((record) => {
                  fallbackSchedule[record.employee_id] = createScheduleEntry(record);
                });
                setTodaySchedule(fallbackSchedule);
              });
          }
          return;
        }
        const nextSchedule = {};
        (data ?? []).forEach((record) => {
          nextSchedule[record.employee_id] = createScheduleEntry(record);
        });
        setTodaySchedule(nextSchedule);
      });
  }, [organizationId, todayDateKey]);

  const getDisplayStatus = (employee) => statusOverrides[employee.id] ?? employee.status;
  // Returns comma-separated string of channels (e.g. "Канада,Латам")
  const getDisplayChannel = (employee) => channelOverrides[employee.id] ?? employee.channel ?? '';
  const getDisplayName = (employee) => nameOverrides[employee.id] ?? employee.name;

  const handleNameSave = async (employee) => {
    const newName = editingNameValue.trim();
    setEditingNameId(null);
    if (!newName || newName === getDisplayName(employee) || nameSaving) return;
    setNameSaving(true);
    const { error } = await supabase
      .from('employees')
      .update({ name: newName })
      .eq('id', employee.id)
      .eq('organization_id', organizationId);
    setNameSaving(false);
    if (error) {
      showToast('Не удалось обновить имя', 'error');
    } else {
      setNameOverrides((prev) => ({ ...prev, [employee.id]: newName }));
      showToast('Имя обновлено');
    }
  };

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
    setStatusError(null);
    const payload = { status: newStatusName };
    await runModalSuccessFlow({
      setSaving: setStatusSaving,
      action: async () => {
        console.log('[EmployeeStatus] update payload', { employeeId: employee.id, organizationId, ...payload });
        const { data, error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', employee.id)
          .eq('organization_id', organizationId)
          .select('id, status')
          .maybeSingle();
        console.log('[EmployeeStatus] update result', { data, error });
        if (error) throw error;
        if (!data) throw new Error('Статус не сохранён. Проверьте RLS-политику UPDATE для employees.');
        return newStatusName;
      },
      reset: (statusName) => setStatusOverrides((prev) => ({ ...prev, [employee.id]: statusName })),
      toast: () => showToast('Статус сотрудника обновлён'),
      close: () => setStatusTarget(null),
      onError: (error) => {
        console.error('[Employees] status update error:', error);
        setStatusError(error?.message || 'Не удалось обновить статус');
      },
    });
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
    setChannelError(null);
    const payload = { channel: newChannelName };
    await runModalSuccessFlow({
      setSaving: setChannelSaving,
      action: async () => {
        const { data, error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', employee.id)
          .eq('organization_id', organizationId)
          .select('id, channel')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Канал не сохранён. Проверьте RLS-политику UPDATE для employees.');
        return newChannelName;
      },
      reset: (channelName) => setChannelOverrides((prev) => ({ ...prev, [employee.id]: channelName })),
      toast: () => showToast('Канал сотрудника обновлён'),
      close: () => setChannelTarget(null),
      onError: (error) => {
        console.error('[Employees] channel update error:', error);
        setChannelError(error?.message || 'Не удалось обновить канал');
      },
    });
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

  const handleScheduleChange = ({ employeeId, dateKey, status, start_time, end_time }) => {
    if (dateKey !== todayDateKey) return;
    setTodaySchedule((prev) => {
      const next = { ...prev };
      if (!status) {
        delete next[employeeId];
      } else {
        next[employeeId] = {
          status,
          start_time: normalizeScheduleTime(start_time),
          end_time: normalizeScheduleTime(end_time),
        };
      }
      return next;
    });
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
    await runModalSuccessFlow({
      setSaving,
      action: async () => {
        const { data, error } = await supabase
          .from('employees')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      reset: (data) => {
        onAdd(toEmployee(data));
        resetForm();
      },
      toast: () => showToast('Сотрудник успешно добавлен'),
      close: () => setAddOpen(false),
      onError: (error) => {
        console.error('[Employees] insert error:', error);
        setAddError(`Ошибка [${error.code || 'network'}]: ${error.message}`);
      },
    });
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
    if (!deleteTarget || deleteSaving) return;
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
    await runModalSuccessFlow({
      setSaving: setDeleteSaving,
      action: async () => {
        const { data: deleted, error } = await supabase
          .from('employees')
          .delete()
          .eq('id', deleteTarget.id)
          .eq('organization_id', organizationId)
          .select('id');
        if (error) throw error;
        if (!deleted || deleted.length === 0) {
          throw new Error('Удаление заблокировано (0 строк затронуто). Нужна RLS-политика для DELETE в таблице employees.');
        }
        console.log(`[Employees] deleted id=${deleteTarget.id} (${deleted.length} row)`);
        return deleteTarget.id;
      },
      reset: (employeeId) => onDelete(employeeId),
      toast: () => showToast('Сотрудник удалён'),
      close: () => setDeleteTarget(null),
      onError: (error) => {
        console.error(`[Employees] delete error for id=${deleteTarget.id}:`, error);
        setDeleteError(error.message ? `Ошибка удаления: ${error.message}` : 'Ошибка удаления.');
      },
    });
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
  }).map((group) => ({
    ...group,
    employees: [...group.employees].sort((a, b) => {
      const aIsWorking = todaySchedule[a.id]?.status === 'work' ? 0 : 1;
      const bIsWorking = todaySchedule[b.id]?.status === 'work' ? 0 : 1;
      if (aIsWorking !== bIsWorking) return aIsWorking - bIsWorking;
      return a.name.localeCompare(b.name, 'ru');
    }),
  }));

  return (
    <>
      <div className="employees-page-head">
        <div>
          <span className="eyebrow">Команда / смены</span>
          <h2>График сотрудников</h2>
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

      <EmployeeSchedulePanel
        employees={employees}
        channels={channels}
        organizationId={organizationId}
        getDisplayChannel={getDisplayChannel}
        onScheduleChange={handleScheduleChange}
        statuses={statuses}
        requestDelete={requestDelete}
        getDisplayStatus={getDisplayStatus}
        getStatusColor={getStatusColor}
        getStatusTone={getStatusTone}
        todaySchedule={todaySchedule}
        openStatusAssignment={openStatusAssignment}
        openChannelAssignment={openChannelAssignment}
        getDisplayName={getDisplayName}
        editingNameId={editingNameId}
        editingNameValue={editingNameValue}
        nameSaving={nameSaving}
        onStartEditName={(emp) => { setEditingNameId(emp.id); setEditingNameValue(getDisplayName(emp)); }}
        onNameChange={setEditingNameValue}
        onNameSave={handleNameSave}
        onNameCancel={() => setEditingNameId(null)}
      />

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
            saving={deleteSaving}
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
            employees={employees}
            onAssignEmployee={(employeeId, channelName) => {
              setChannelOverrides((prev) => ({ ...prev, [employeeId]: channelName ?? '' }));
            }}
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
  // Support comma-separated multi-channel: "Канада,Латам"
  const currentChannels = employee.channel
    ? employee.channel.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const [selected, setSelected] = useState(currentChannels);

  useModalScrollLock();

  useEffect(() => {
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggle = (name) => setSelected((prev) =>
    prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
  );

  const handleSave = () => onAssign(selected.join(','));

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
              <div className="status-modal-avatar"><Avatar name={employee.name} /></div>
              <div className="status-modal-heading">
                <span className="eyebrow">Каналы сотрудника</span>
                <h3>{employee.name}</h3>
                <p>Можно выбрать несколько</p>
              </div>
            </div>
            <button className="icon-button" type="button" onClick={onClose}><X size={16} /></button>
          </motion.div>

          <motion.div className="status-current status-current--hero" variants={modalSectionVariants}>
            <span>Текущие каналы</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {currentChannels.length > 0
                ? currentChannels.map((ch) => (
                    <ChannelBadge key={ch} name={ch} color={getChannelColor(ch, channels)} />
                  ))
                : <ChannelBadge name="Без канала" color="#8a8fa8" />
              }
            </div>
          </motion.div>

          <motion.div variants={modalSectionVariants}>
            {channels.length === 0 ? (
              <div className="status-empty">
                <strong>Сначала создайте канал</strong>
                <p>После создания каналы появятся здесь.</p>
                <button className="ghost-button" type="button" onClick={onManage}>Управление каналами</button>
              </div>
            ) : (
              <div className="status-options-panel">
                <span className="status-options-label">Выберите каналы</span>
                <div className="status-choice-list">
                  {channels.map((channel) => {
                    const isSelected = selected.includes(channel.name);
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        className={`status-choice ${isSelected ? 'selected' : ''}`}
                        disabled={saving}
                        onClick={() => toggle(channel.name)}
                      >
                        <span className="status-choice-main">
                          <span className="status-choice-dot" style={{ background: channel.color }} />
                          <span>{channel.name}</span>
                        </span>
                        <span className="status-choice-check" aria-hidden="true">
                          {isSelected && <Check size={16} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <motion.button
                  className="primary-button"
                  type="button"
                  style={{ marginTop: 12, width: '100%' }}
                  whileTap={{ scale: 0.97 }}
                  disabled={saving}
                  onClick={handleSave}
                >
                  Сохранить
                </motion.button>
              </div>
            )}
          </motion.div>

          {error && <motion.p className="status-error" variants={modalSectionVariants}>{error}</motion.p>}
        </motion.div>
      </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

function EmployeeSchedulePanel({ employees, channels, organizationId, getDisplayChannel, onScheduleChange, statuses, requestDelete, getDisplayStatus, getStatusColor, getStatusTone, todaySchedule, openStatusAssignment, openChannelAssignment, getDisplayName, editingNameId, editingNameValue, nameSaving, onStartEditName, onNameChange, onNameSave, onNameCancel }) {
  const showToast = useToast();
  const [schedule, setSchedule] = useState({});
  const [employeeShiftDefaults, setEmployeeShiftDefaults] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState(null);
  const [selector, setSelector] = useState(null);
  const [error, setError] = useState(null);
  const dates = getMonthDates();

  useEffect(() => {
    if (!organizationId || employees.length === 0) {
      setSchedule({});
      setEmployeeShiftDefaults({});
      setLoading(false);
      return;
    }

    const loadSchedule = async () => {
      setLoading(true);
      setError(null);
      const employeeIds = employees.map((employee) => employee.id);
      const from = formatDateKey(dates[0]);
      const to = formatDateKey(dates[dates.length - 1]);
      const { data, error: fetchError } = await supabase
        .from('employee_schedule')
        .select('id, employee_id, work_date, status, start_time, end_time')
        .eq('organization_id', organizationId)
        .in('employee_id', employeeIds)
        .gte('work_date', from)
        .lte('work_date', to);

      setLoading(false);
      if (fetchError) {
        console.error('[EmployeeSchedule] fetch error:', fetchError);
        if (fetchError.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('employee_schedule')
            .select('id, employee_id, work_date, status')
            .eq('organization_id', organizationId)
            .in('employee_id', employeeIds)
            .gte('work_date', from)
            .lte('work_date', to);

          if (fallbackError) {
            console.error('[EmployeeSchedule] fallback fetch error:', fallbackError);
            setError('Не удалось загрузить график.');
            return;
          }

          const fallbackMap = {};
          (fallbackData ?? []).forEach((row) => {
            fallbackMap[`${row.employee_id}:${row.work_date}`] = createScheduleEntry(row);
          });
          setSchedule(fallbackMap);
          setError('Чтобы сохранять время смен, добавьте SQL-колонки start_time и end_time.');
          return;
        }
        setError('Не удалось загрузить график.');
        return;
      }

      const map = {};
      const defaults = {};
      const rows = data ?? [];
      rows.forEach((row) => {
        map[`${row.employee_id}:${row.work_date}`] = createScheduleEntry(row);
      });
      rows
        .filter((row) => (
          row.status === 'work'
          && normalizeScheduleTime(row.start_time)
          && normalizeScheduleTime(row.end_time)
        ))
        .sort((a, b) => String(a.work_date).localeCompare(String(b.work_date)))
        .forEach((row) => {
          defaults[row.employee_id] = {
            start_time: normalizeScheduleTime(row.start_time),
            end_time: normalizeScheduleTime(row.end_time),
          };
        });
      setSchedule(map);
      setEmployeeShiftDefaults((prev) => ({ ...defaults, ...prev }));
    };

    loadSchedule();
  }, [organizationId, employees]);

  const groupedEmployees = employees.reduce((groups, employee) => {
    const displayChannel = getDisplayChannel(employee);
    const channelNames = displayChannel
      ? displayChannel.split(',').map((s) => s.trim()).filter(Boolean)
      : ['Без канала'];
    channelNames.forEach((channelName) => {
      if (!groups[channelName]) {
        groups[channelName] = {
          name: channelName,
          color: channelName !== 'Без канала' ? getChannelColor(channelName, channels) : '#8a8fa8',
          employees: [],
        };
      }
      if (!groups[channelName].employees.find((e) => e.id === employee.id)) {
        groups[channelName].employees.push(employee);
      }
    });
    return groups;
  }, {});

  const todayKey = getMoscowDateKey();

  const groups = Object.values(groupedEmployees).sort((a, b) => {
    if (a.name === 'Без канала') return 1;
    if (b.name === 'Без канала') return -1;
    return a.name.localeCompare(b.name, 'ru');
  }).map((group) => ({
    ...group,
    employees: [...group.employees].sort((a, b) => {
      const aStatus = schedule[`${a.id}:${todayKey}`]?.status ?? schedule[`${a.id}:${todayKey}`];
      const bStatus = schedule[`${b.id}:${todayKey}`]?.status ?? schedule[`${b.id}:${todayKey}`];
      const aWorking = aStatus === 'work' ? 0 : aStatus ? 1 : 2;
      const bWorking = bStatus === 'work' ? 0 : bStatus ? 1 : 2;
      if (aWorking !== bWorking) return aWorking - bWorking;
      return a.name.localeCompare(b.name, 'ru');
    }),
  }));

  const handleCellChange = async (employee, dateKey, nextStatus, shift = {}) => {
    const cellKey = `${employee.id}:${dateKey}`;
    setError(null);

    if (nextStatus === 'unset') {
      await runModalSuccessFlow({
        setSaving: (active) => setSavingCell(active ? cellKey : null),
        action: async () => {
          const { error: deleteError } = await supabase
            .from('employee_schedule')
            .delete()
            .eq('organization_id', organizationId)
            .eq('employee_id', employee.id)
            .eq('work_date', dateKey);
          if (deleteError) throw deleteError;
          return null;
        },
        reset: () => {
          setSelector(null);
          setSchedule((prev) => {
            const next = { ...prev };
            delete next[cellKey];
            return next;
          });
          onScheduleChange?.({ employeeId: employee.id, dateKey, status: null, start_time: null, end_time: null });
        },
        toast: () => showToast('График обновлён'),
        onError: (error) => {
          console.error('[EmployeeSchedule] delete error:', error);
          setSelector(null);
          setError('Не удалось очистить день.');
        },
      });
      return;
    }

    const payload = {
      organization_id: organizationId,
      employee_id: employee.id,
      work_date: dateKey,
      status: nextStatus,
      start_time: nextStatus === 'work' ? shift.start_time : null,
      end_time: nextStatus === 'work' ? shift.end_time : null,
      updated_at: new Date().toISOString(),
    };

    await runModalSuccessFlow({
      setSaving: (active) => setSavingCell(active ? cellKey : null),
      action: async () => {
        const { data, error: upsertError } = await supabase
          .from('employee_schedule')
          .upsert(payload, { onConflict: 'employee_id,work_date' })
          .select('id, employee_id, work_date, status, start_time, end_time')
          .single();
        if (upsertError) throw upsertError;
        return data;
      },
      reset: (data) => {
        setSelector(null);
        const entry = createScheduleEntry(data);
        setSchedule((prev) => ({ ...prev, [cellKey]: entry }));
        if (entry?.status === 'work' && entry.start_time && entry.end_time) {
          setEmployeeShiftDefaults((prev) => ({
            ...prev,
            [employee.id]: {
              start_time: entry.start_time,
              end_time: entry.end_time,
            },
          }));
        }
        onScheduleChange?.({ employeeId: employee.id, dateKey, ...entry });
      },
      toast: () => showToast('График обновлён'),
      onError: (error) => {
        console.error('[EmployeeSchedule] upsert error:', error);
        setSelector(null);
        setError(error.code === '42703' ? 'Добавьте SQL-колонки start_time и end_time для сохранения времени.' : 'Не удалось сохранить день.');
      },
    });
  };

  const openScheduleSelector = (cellKey, employee, dateKey, entry, triggerElement) => {
    const employeeDefault = employeeShiftDefaults[employee.id] ?? {};
    const currentStart = normalizeScheduleTime(entry?.start_time)
      || normalizeScheduleTime(employeeDefault.start_time)
      || DEFAULT_SHIFT_START;
    const currentEnd = normalizeScheduleTime(entry?.end_time)
      || normalizeScheduleTime(employeeDefault.end_time)
      || DEFAULT_SHIFT_END;
    const triggerRect = triggerElement?.getBoundingClientRect();
    const scrollFrame = triggerElement?.closest('.employee-schedule-table-wrap');
    const frameRect = scrollFrame?.getBoundingClientRect();
    const spaceBelow = triggerRect && frameRect ? frameRect.bottom - triggerRect.bottom : Infinity;
    const spaceAbove = triggerRect && frameRect ? triggerRect.top - frameRect.top : 0;
    const placement = spaceBelow < SCHEDULE_SELECTOR_HEIGHT && spaceAbove > spaceBelow ? 'top' : 'bottom';
    setSelector({
      cellKey,
      employee,
      dateKey,
      startTime: currentStart,
      endTime: currentEnd,
      placement,
    });
  };

  const updateSelectorTime = (field, value) => {
    setSelector((current) => current ? { ...current, [field]: value } : current);
  };

  return (
    <div className="employee-schedule-panel">
      <div className="employee-schedule-toolbar">
        <span className="employee-schedule-month-label">{getMonthLabel()}</span>
        <div className="employee-schedule-legend">
          {Object.entries(SCHEDULE_STATUSES).map(([key, item]) => (
            <span key={key}><i style={{ background: item.color }}>{item.short}</i> — {item.label}</span>
          ))}
        </div>
      </div>

      {error && <p className="status-error">{error}</p>}

      <div className="employee-schedule-table-wrap">
        {loading ? (
          <div className="employee-schedule-empty">Загружаем график...</div>
        ) : employees.length === 0 ? (
          <div className="employee-schedule-empty">Добавьте первого сотрудника, чтобы начать.</div>
        ) : (
          <div className="employee-schedule-table" style={{ '--schedule-days': dates.length }}>
            <div className="employee-schedule-header-row">
              <div className="employee-schedule-name-cell sticky">Сотрудник</div>
              {dates.map((date, index) => {
                const isFirstOfMonth = index === 0 || date.getMonth() !== dates[index - 1].getMonth();
                const monthLabel = isFirstOfMonth ? date.toLocaleDateString('ru-RU', { month: 'long' }) : null;
                return (
                  <div key={formatDateKey(date)} className="employee-schedule-date-cell">
                    {monthLabel && <em className="schedule-month-label">{monthLabel}</em>}
                    <strong>{formatScheduleDay(date)}</strong>
                    <span>{formatScheduleWeekday(date)}</span>
                  </div>
                );
              })}
            </div>

            {groups.map((group) => (
              <div className="employee-schedule-group" key={group.name}>
                <div className="employee-schedule-group-row">
                  <span className="employee-channel-dot" style={{ background: group.color }} />
                  {group.name}
                </div>
                {group.employees.map((employee) => {
                  const displayStatus = getDisplayStatus(employee);
                  const customColor = getStatusColor(displayStatus, statuses);
                  const fallbackTone = getStatusTone(displayStatus);
                  return (
                  <div className="employee-schedule-row-wrap" key={employee.id}>
                  <div className="employee-schedule-row">
                    <div className="employee-schedule-name-cell sticky">
                      <Avatar name={getDisplayName ? getDisplayName(employee) : employee.name} />
                      <div className="employee-schedule-name-info">
                        {editingNameId === employee.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              autoFocus
                              className="inline-name-input"
                              value={editingNameValue}
                              onChange={(e) => onNameChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') onNameSave(employee);
                                if (e.key === 'Escape') onNameCancel();
                              }}
                              disabled={nameSaving}
                              style={{ fontSize: '0.85rem', fontWeight: 600, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--text)', width: 120 }}
                            />
                            <button type="button" className="ghost-icon-btn" onClick={() => onNameSave(employee)} disabled={nameSaving} style={{ color: 'var(--accent)', padding: 2 }}>
                              <Check size={14} />
                            </button>
                            <button type="button" className="ghost-icon-btn" onClick={onNameCancel} disabled={nameSaving} style={{ padding: 2 }}>
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <strong>{getDisplayName ? getDisplayName(employee) : employee.name}</strong>
                            <button type="button" className="ghost-icon-btn" onClick={(e) => { e.stopPropagation(); onStartEditName(employee); }} style={{ opacity: 0.4, padding: 2 }}>
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}
                        <div className="employee-schedule-name-sub">
                          <button
                            type="button"
                            className="status-badge-clickable"
                            onClick={(e) => { e.stopPropagation(); openStatusAssignment({ ...employee, status: displayStatus, statusTone: fallbackTone }, e); }}
                          >
                            <StatusBadge name={displayStatus} statusTone={fallbackTone} color={customColor} />
                          </button>
                          <TodayScheduleBadge entry={todaySchedule[employee.id]} />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="employee-delete"
                        onClick={(e) => { e.stopPropagation(); requestDelete(employee, e); }}
                      ><Trash2 size={14} /></button>
                    </div>
                          {dates.map((date) => {
                            const dateKey = formatDateKey(date);
                            const cellKey = `${employee.id}:${dateKey}`;
                            const scheduleEntry = schedule[cellKey];
                            const statusKey = typeof scheduleEntry === 'string' ? scheduleEntry : scheduleEntry?.status;
                            const statusMeta = SCHEDULE_STATUSES[statusKey];
                            const selectorOpen = selector?.cellKey === cellKey;
                            return (
                              <div key={cellKey} className="employee-schedule-cell-wrap">
                                <button
                                  type="button"
                                  className={`employee-schedule-cell ${statusKey ? 'filled' : 'unset'}`}
                                  style={statusMeta ? {
                                    color: statusMeta.color,
                                    background: hexToRgba(statusMeta.color, 0.12),
                                    borderColor: hexToRgba(statusMeta.color, 0.28),
                                  } : undefined}
                                  disabled={savingCell === cellKey}
                                  onClick={(event) => selectorOpen ? setSelector(null) : openScheduleSelector(cellKey, employee, dateKey, scheduleEntry, event.currentTarget)}
                                >
                                  {savingCell === cellKey ? '...' : statusMeta?.short || '—'}
                                </button>
                                <AnimatePresence>
                                  {selectorOpen && (
                                    <motion.div
                                      className={`employee-schedule-selector employee-schedule-selector--${selector.placement || 'bottom'}`}
                                      initial={{
                                        opacity: 0,
                                        x: '-50%',
                                        y: selector.placement === 'top' ? -8 : 8,
                                        scale: 0.96,
                                      }}
                                      animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
                                      exit={{
                                        opacity: 0,
                                        x: '-50%',
                                        y: selector.placement === 'top' ? -6 : 6,
                                        scale: 0.97,
                                      }}
                                      transition={{ duration: 0.18 }}
                                    >
                                      <div className="employee-schedule-shift-editor">
                                        <div className="employee-schedule-shift-title">
                                          <i style={{ background: SCHEDULE_STATUSES.work.color }}>{SCHEDULE_STATUSES.work.short}</i>
                                          <span>{SCHEDULE_STATUSES.work.label}</span>
                                        </div>
                                        <div className="employee-schedule-time-grid">
                                          <label>
                                            <span>С</span>
                                            <input
                                              type="time"
                                              value={selector.startTime}
                                              onChange={(event) => updateSelectorTime('startTime', event.target.value)}
                                            />
                                          </label>
                                          <label>
                                            <span>До</span>
                                            <input
                                              type="time"
                                              value={selector.endTime}
                                              onChange={(event) => updateSelectorTime('endTime', event.target.value)}
                                            />
                                          </label>
                                        </div>
                                        <button
                                          type="button"
                                          className="employee-schedule-save-shift"
                                          onClick={() => handleCellChange(employee, dateKey, 'work', {
                                            start_time: selector.startTime || DEFAULT_SHIFT_START,
                                            end_time: selector.endTime || DEFAULT_SHIFT_END,
                                          })}
                                        >
                                          Сохранить смену
                                        </button>
                                      </div>
                                      {Object.entries(SCHEDULE_STATUSES).filter(([key]) => key !== 'work').map(([key, item]) => (
                                        <button key={key} type="button" onClick={() => handleCellChange(employee, dateKey, key)}>
                                          <i style={{ background: item.color }}>{item.short}</i>
                                          {item.label}
                                        </button>
                                      ))}
                                      <button type="button" onClick={() => handleCellChange(employee, dateKey, 'unset')}>
                                        <i>—</i>
                                        Очистить
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                    </div>
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
