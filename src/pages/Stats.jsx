import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, X, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useToast } from '../components/Toast.jsx';
import { Avatar } from '../components/shared.jsx';
import { ModalPortal, modalContentVariants, modalSectionVariants, useModalScrollLock } from '../components/modal.jsx';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.slice(0, 4)) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.slice(5, 7)) - 1 : new Date().getMonth());
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayDate = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Выбрать дату';

  const getDays = () => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const today = toDateKey(new Date());

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="datepicker-trigger"
        onClick={() => setOpen(o => !o)}
      >
        <Calendar size={15} />
        <span>{displayDate}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="datepicker-popup"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="datepicker-header">
              <button type="button" className="datepicker-nav" onClick={prevMonth}><ChevronLeft size={15} /></button>
              <span>{MONTHS[viewMonth]} {viewYear}</span>
              <button type="button" className="datepicker-nav" onClick={nextMonth}><ChevronRight size={15} /></button>
            </div>
            <div className="datepicker-weekdays">
              {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
            </div>
            <div className="datepicker-grid">
              {getDays().map((day, i) => {
                if (!day) return <span key={`e-${i}`} />;
                const mm = String(viewMonth + 1).padStart(2, '0');
                const dd = String(day).padStart(2, '0');
                const key = `${viewYear}-${mm}-${dd}`;
                const isSelected = key === value;
                const isToday = key === today;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`datepicker-day${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' today' : ''}`}
                    onClick={() => selectDay(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function weekLabel(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const month = weekEnd.toLocaleDateString('ru-RU', { month: 'long' });
  return `${startDay}–${endDay} ${month}`;
}

function monthLabel(date) {
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function pct(num, denom) {
  if (!denom) return null;
  return Math.round((num / denom) * 100);
}

function PctCell({ value }) {
  if (value === null) return <span style={{ color: 'var(--muted)', opacity: 0.5 }}>—</span>;
  const color = value >= 50 ? 'var(--success)' : value >= 25 ? 'var(--warning)' : 'var(--danger)';
  return <span style={{ color, fontWeight: 700 }}>{value}%</span>;
}

function AddStatsModal({ employees, organizationId, onClose, onSaved }) {
  useModalScrollLock();
  const showToast = useToast();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [date, setDate] = useState(toDateKey(new Date()));
  const [dialogs, setDialogs] = useState('');
  const [registrations, setRegistrations] = useState('');
  const [firstDeposits, setFirstDeposits] = useState('');
  const [repeatDeposits, setRepeatDeposits] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId || !date || saving) return;
    setSaving(true);
    const { error } = await supabase.from('employee_stats').upsert(
      {
        organization_id: organizationId,
        employee_id: employeeId,
        date,
        dialogs: parseInt(dialogs) || 0,
        registrations: parseInt(registrations) || 0,
        first_deposits: parseInt(firstDeposits) || 0,
        repeat_deposits: parseInt(repeatDeposits) || 0,
      },
      { onConflict: 'organization_id,employee_id,date' }
    );
    setSaving(false);
    if (error) { showToast?.('Не удалось сохранить', 'error'); return; }
    showToast?.('Данные сохранены');
    onSaved();
    onClose();
  };

  return (
    <ModalPortal>
      <motion.div
        className="modal-backdrop employee-modal-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.form
          className="modal-shell modal-shell--small"
          role="dialog" aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Статистика продаж</span>
                <h2>Добавить данные</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            <motion.div className="stats-form-grid" variants={modalSectionVariants}>
              <label className="stats-form-field">
                <span>Сотрудник</span>
                <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </label>
              <div className="stats-form-field">
                <span>Дата</span>
                <DatePicker value={date} onChange={setDate} />
              </div>
              <label className="stats-form-field">
                <span>Диалоги</span>
                <input type="number" min="0" value={dialogs} onChange={(e) => setDialogs(e.target.value)} placeholder="0" />
              </label>
              <label className="stats-form-field">
                <span>Регистрации</span>
                <input type="number" min="0" value={registrations} onChange={(e) => setRegistrations(e.target.value)} placeholder="0" />
              </label>
              <label className="stats-form-field">
                <span>ФД (первый депозит)</span>
                <input type="number" min="0" value={firstDeposits} onChange={(e) => setFirstDeposits(e.target.value)} placeholder="0" />
              </label>
              <label className="stats-form-field">
                <span>РД (повторный депозит)</span>
                <input type="number" min="0" value={repeatDeposits} onChange={(e) => setRepeatDeposits(e.target.value)} placeholder="0" />
              </label>
            </motion.div>

            <motion.div className="modal-actions" variants={modalSectionVariants}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>Отмена</motion.button>
              <motion.button className="primary-button" type="submit" whileTap={{ scale: saving ? 1 : 0.97 }} disabled={saving}>
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.form>
      </motion.div>
    </ModalPortal>
  );
}

export function Stats({ employees, employeesLoading, organizationId }) {
  const [viewMode, setViewMode] = useState('week');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const { rangeStart, rangeEnd, label } = useMemo(() => {
    const today = new Date();
    if (viewMode === 'week') {
      const ws = getWeekStart(today);
      ws.setDate(ws.getDate() + periodOffset * 7);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      return { rangeStart: toDateKey(ws), rangeEnd: toDateKey(we), label: weekLabel(ws) };
    } else {
      const d = new Date(today.getFullYear(), today.getMonth() + periodOffset, 1);
      const me = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { rangeStart: toDateKey(d), rangeEnd: toDateKey(me), label: monthLabel(d) };
    }
  }, [viewMode, periodOffset]);

  const loadStats = async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('employee_stats')
      .select('employee_id, date, dialogs, registrations, first_deposits, repeat_deposits')
      .eq('organization_id', organizationId)
      .gte('date', rangeStart)
      .lte('date', rangeEnd);
    if (!error) setStats(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, [organizationId, rangeStart, rangeEnd]);

  const employeeStatsMap = useMemo(() => {
    const map = {};
    stats.forEach((row) => {
      if (!map[row.employee_id]) map[row.employee_id] = { dialogs: 0, registrations: 0, first_deposits: 0, repeat_deposits: 0 };
      map[row.employee_id].dialogs += row.dialogs || 0;
      map[row.employee_id].registrations += row.registrations || 0;
      map[row.employee_id].first_deposits += row.first_deposits || 0;
      map[row.employee_id].repeat_deposits += row.repeat_deposits || 0;
    });
    return map;
  }, [stats]);

  const totals = useMemo(() => {
    const t = { dialogs: 0, registrations: 0, first_deposits: 0, repeat_deposits: 0 };
    Object.values(employeeStatsMap).forEach((s) => {
      t.dialogs += s.dialogs;
      t.registrations += s.registrations;
      t.first_deposits += s.first_deposits;
      t.repeat_deposits += s.repeat_deposits;
    });
    return t;
  }, [employeeStatsMap]);

  const channelGroups = useMemo(() => {
    const groups = {};
    employees.forEach((emp) => {
      const ch = emp.channel || 'Без канала';
      if (!groups[ch]) groups[ch] = [];
      groups[ch].push(emp);
    });
    return groups;
  }, [employees]);

  const kpis = [
    { label: 'Диалоги', value: loading ? '…' : totals.dialogs },
    { label: 'Регистрации', value: loading ? '…' : totals.registrations },
    { label: 'ФД', value: loading ? '…' : totals.first_deposits },
    { label: 'РД', value: loading ? '…' : totals.repeat_deposits },
    { label: '% Рег', pctVal: pct(totals.registrations, totals.dialogs) },
    { label: '% ФД', pctVal: pct(totals.first_deposits, totals.registrations) },
    { label: '% РД', pctVal: pct(totals.repeat_deposits, totals.first_deposits) },
  ];

  return (
    <>
      <div className="stats-head">
        <div>
          <span className="eyebrow">Показатели команды</span>
          <h2>Статистика продаж</h2>
        </div>
        <button className="primary-button" type="button" onClick={() => setAddOpen(true)}>
          <Plus size={16} />
          Добавить
        </button>
      </div>

      <div className="stats-toolbar">
        <div className="stats-mode-pills">
          {[['week', 'Неделя'], ['month', 'Месяц']].map(([mode, lbl]) => (
            <button
              key={mode}
              type="button"
              className={`qtc-pill${viewMode === mode ? ' active' : ''}`}
              onClick={() => { setViewMode(mode); setPeriodOffset(0); }}
            >
              {lbl}
            </button>
          ))}
        </div>
        <div className="stats-period-nav">
          <button type="button" className="icon-button" onClick={() => setPeriodOffset((o) => o - 1)}>
            <ChevronLeft size={16} />
          </button>
          <span className="stats-period-label">{label}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPeriodOffset((o) => o + 1)}
            disabled={periodOffset >= 0}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="stats-kpi-row">
        {kpis.map(({ label: kLabel, value, pctVal }) => {
          const isPct = pctVal !== undefined;
          const color = isPct
            ? (pctVal === null ? 'var(--muted)' : pctVal >= 50 ? 'var(--success)' : pctVal >= 25 ? 'var(--warning)' : 'var(--danger)')
            : 'var(--text)';
          return (
            <div key={kLabel} className="stats-kpi-card">
              <span>{kLabel}</span>
              <strong style={{ color }}>
                {isPct ? (pctVal === null ? '—' : `${pctVal}%`) : value}
              </strong>
            </div>
          );
        })}
      </div>

      <div className="stats-table-wrap">
        <div className="stats-table">
          <div className="stats-header-row">
            <div className="stats-name-col">Сотрудник</div>
            <div>Диалоги</div>
            <div>Рег</div>
            <div>ФД</div>
            <div>РД</div>
            <div>% Рег</div>
            <div>% ФД</div>
            <div>% РД</div>
          </div>

          {employeesLoading || loading ? (
            <p className="stats-empty">Загружаем…</p>
          ) : employees.length === 0 ? (
            <p className="stats-empty">Сотрудников пока нет.</p>
          ) : (
            <div className="stats-groups">
              {Object.entries(channelGroups).map(([channel, channelEmps]) => (
                <div key={channel} className="stats-group">
                  <div className="stats-group-label">
                    <i className="stats-group-dot" />
                    {channel}
                  </div>
                  {channelEmps.map((emp) => {
                    const s = employeeStatsMap[emp.id] ?? { dialogs: 0, registrations: 0, first_deposits: 0, repeat_deposits: 0 };
                    const hasData = s.dialogs > 0 || s.registrations > 0 || s.first_deposits > 0 || s.repeat_deposits > 0;
                    return (
                      <motion.div
                        key={emp.id}
                        className="stats-row"
                        whileHover={{ backgroundColor: 'rgba(119,101,227,0.04)' }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className="stats-name-col">
                          <Avatar name={emp.name} />
                          <span>{emp.name}</span>
                        </div>
                        <div>{hasData ? <b>{s.dialogs}</b> : <span className="stats-zero">—</span>}</div>
                        <div>{hasData ? <b>{s.registrations}</b> : <span className="stats-zero">—</span>}</div>
                        <div>{hasData ? <b>{s.first_deposits}</b> : <span className="stats-zero">—</span>}</div>
                        <div>{hasData ? <b>{s.repeat_deposits}</b> : <span className="stats-zero">—</span>}</div>
                        <div><PctCell value={hasData ? pct(s.registrations, s.dialogs) : null} /></div>
                        <div><PctCell value={hasData ? pct(s.first_deposits, s.registrations) : null} /></div>
                        <div><PctCell value={hasData ? pct(s.repeat_deposits, s.first_deposits) : null} /></div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {addOpen && (
          <AddStatsModal
            employees={employees}
            organizationId={organizationId}
            onClose={() => setAddOpen(false)}
            onSaved={loadStats}
          />
        )}
      </AnimatePresence>
    </>
  );
}
