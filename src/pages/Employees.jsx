import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CalendarDays, Check, Plus, Radio, Tag, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { Avatar, AnimatedProgress } from '../components/shared.jsx';
import { employeeCardTransition, EmployeeFormModal, DeleteEmployeeModal, StatusManagementModal, ChannelManagementModal } from '../components/modals.jsx';
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

function getScheduleDates(period) {
  const count = period === 'month' ? 30 : 14;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
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
  const [channelOverrides, setChannelOverrides] = useState({}); // {employeeId: channelName}
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [todaySchedule, setTodaySchedule] = useState({});
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
            className="ghost-button"
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -2 }}
            onClick={() => setScheduleOpen(true)}
          >
            <CalendarDays size={15} />
            График
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
                          <TodayScheduleBadge entry={todaySchedule[employee.id]} />
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
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scheduleOpen && (
          <EmployeeScheduleModal
            employees={employees}
            channels={channels}
            organizationId={organizationId}
            getDisplayChannel={getDisplayChannel}
            onScheduleChange={handleScheduleChange}
            onClose={() => setScheduleOpen(false)}
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

function EmployeeScheduleModal({ employees, channels, organizationId, getDisplayChannel, onScheduleChange, onClose }) {
  const showToast = useToast();
  const [period, setPeriod] = useState('two_weeks');
  const [schedule, setSchedule] = useState({});
  const [employeeShiftDefaults, setEmployeeShiftDefaults] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState(null);
  const [selector, setSelector] = useState(null);
  const [error, setError] = useState(null);
  const dates = getScheduleDates(period);

  useModalScrollLock();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
  }, [organizationId, employees, period]);

  const groupedEmployees = employees.reduce((groups, employee) => {
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

  const groups = Object.values(groupedEmployees).sort((a, b) => {
    if (a.name === 'Без канала') return 1;
    if (b.name === 'Без канала') return -1;
    return a.name.localeCompare(b.name, 'ru');
  });

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
    <ModalPortal>
      <motion.div className="modal-backdrop employee-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div
          className="modal-shell modal-shell--large employee-schedule-modal"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          initial={modalMotion.initial}
          animate={modalMotion.animate}
          exit={modalMotion.exit}
          transition={modalMotion.transition}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="modal-title employee-schedule-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Команда / смены</span>
                <h2>График сотрудников</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            <motion.div className="employee-schedule-toolbar" variants={modalSectionVariants}>
              <div className="employee-schedule-period">
                <button className={period === 'two_weeks' ? 'active' : ''} type="button" onClick={() => setPeriod('two_weeks')}>2 недели</button>
                <button className={period === 'month' ? 'active' : ''} type="button" onClick={() => setPeriod('month')}>Месяц</button>
              </div>
              <div className="employee-schedule-legend">
                {Object.entries(SCHEDULE_STATUSES).map(([key, item]) => (
                  <span key={key}><i style={{ background: item.color }}>{item.short}</i> — {item.label}</span>
                ))}
              </div>
            </motion.div>

            {error && <motion.p className="status-error" variants={modalSectionVariants}>{error}</motion.p>}

            <motion.div className="employee-schedule-table-wrap" variants={modalSectionVariants}>
              {loading ? (
                <div className="employee-schedule-empty">Загружаем график...</div>
              ) : employees.length === 0 ? (
                <div className="employee-schedule-empty">Сначала добавьте сотрудников.</div>
              ) : (
                <div className="employee-schedule-table" style={{ '--schedule-days': dates.length }}>
                  <div className="employee-schedule-header-row">
                    <div className="employee-schedule-name-cell sticky">Сотрудник</div>
                    {dates.map((date) => (
                      <div key={formatDateKey(date)} className="employee-schedule-date-cell">
                        <strong>{formatScheduleDay(date)}</strong>
                        <span>{formatScheduleWeekday(date)}</span>
                      </div>
                    ))}
                  </div>

                  {groups.map((group) => (
                    <div className="employee-schedule-group" key={group.name}>
                      <div className="employee-schedule-group-row">
                        <span className="employee-channel-dot" style={{ background: group.color }} />
                        {group.name}
                      </div>
                      {group.employees.map((employee) => (
                        <div className="employee-schedule-row" key={employee.id}>
                          <div className="employee-schedule-name-cell sticky">
                            <Avatar name={employee.name} />
                            <span>{employee.name}</span>
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
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}
