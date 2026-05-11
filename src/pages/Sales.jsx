import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, CalendarDays, Pencil, Plus, Save, Trash2, Trophy, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { PremiumCard } from '../components/shared.jsx';
import { modalMotion, modalContentVariants, modalSectionVariants, useModalScrollLock, ModalPortal } from '../components/modal.jsx';
import { aggregateSales, formatCash, getWeekStart, getMonthStart } from '../lib/salesMetrics.js';
import { useToast } from '../components/Toast.jsx';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
}

function fmtShortDate(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

function initials(name) {
  return (name ?? '').split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getPeriodStart(period) {
  return period === 'week' ? getWeekStart() : getMonthStart();
}

function getWeekRangeLabel() {
  const start = getWeekStart();
  const end = addDaysIso(start, 6);
  return `Неделя: ${fmtShortDate(start)}–${fmtShortDate(end)}`;
}

function getMonthLabel() {
  return new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function weekKeyFromIso(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function dynamicsLabel(key, mode) {
  if (mode === 'weeks') return `${fmtShortDate(key)}–${fmtShortDate(addDaysIso(key, 6))}`;
  if (mode === 'months') {
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('ru-RU', { month: 'short' });
  }
  return fmtShortDate(key);
}

function summarizeRows(rows = []) {
  return rows.reduce(
    (acc, row) => ({
      deposits: acc.deposits + (row.deposits_count ?? 0),
      cash: acc.cash + Number(row.cash_amount ?? 0),
    }),
    { deposits: 0, cash: 0 }
  );
}

function getPeriodRange(period) {
  if (period === 'week') {
    const start = getWeekStart();
    return `${fmtShortDate(start)}–${fmtShortDate(addDaysIso(start, 6))}`;
  }
  const start = getMonthStart();
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return `${fmtShortDate(start)}–${fmtShortDate(end)}`;
}

const salesSharedTransition = {
  layout: { type: 'spring', damping: 34, stiffness: 360 },
  opacity: { duration: 0.18 },
  scale: { duration: 0.18 },
};

// ─── Add Sales Modal ─────────────────────────────────────────────────────────

function AddSalesModal({ employees, organizationId, onClose, onSaved }) {
  useModalScrollLock();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    employee_id: employees[0]?.id ?? '',
    deposits_count: '',
    cash_amount: '',
    record_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = form.employee_id && (form.deposits_count !== '' || form.cash_amount !== '') && form.record_date;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    const rowId = crypto.randomUUID();
    const payload = {
      id: rowId,
      employee_id: form.employee_id,
      organization_id: organizationId,
      deposits_count: form.deposits_count !== '' ? parseInt(form.deposits_count, 10) : 0,
      cash_amount: form.cash_amount !== '' ? parseFloat(form.cash_amount) : 0,
      record_date: form.record_date,
    };
    const { error: err } = await supabase.from('employee_sales').insert(payload);
    setSaving(false);
    if (err) { setError(`Ошибка: ${err.message}`); return; }
    showToast('Показатели добавлены', 'success');
    setForm({
      employee_id: employees[0]?.id ?? '',
      deposits_count: '',
      cash_amount: '',
      record_date: new Date().toISOString().slice(0, 10),
    });
    onSaved(payload);
    onClose();
  };

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop employee-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.form
          className="modal-shell modal-shell--small employee-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          initial={modalMotion.initial}
          animate={modalMotion.animate}
          exit={modalMotion.exit}
          transition={modalMotion.transition}
          onSubmit={handleSubmit}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Коммерческие показатели</span>
                <h2>Добавить данные</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            <motion.div className="employee-form-grid" variants={modalSectionVariants}>
              <label>
                <span>Сотрудник</span>
                <select
                  value={form.employee_id}
                  onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                  style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--line)', background: 'rgba(255,255,255,0.84)', color: 'var(--text)', fontSize: 14 }}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Дата</span>
                <input type="date" value={form.record_date} onChange={(e) => setForm((f) => ({ ...f, record_date: e.target.value }))} />
              </label>
              <label>
                <span>Количество депозитов</span>
                <input type="number" min="0" placeholder="0" value={form.deposits_count} onChange={(e) => setForm((f) => ({ ...f, deposits_count: e.target.value }))} />
              </label>
              <label>
                <span>Сумма (USD)</span>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.cash_amount} onChange={(e) => setForm((f) => ({ ...f, cash_amount: e.target.value }))} />
              </label>
            </motion.div>

            {error && (
              <motion.p variants={modalSectionVariants} style={{ fontSize: '0.82rem', color: 'var(--danger)', textAlign: 'center', marginBottom: 4 }}>
                {error}
              </motion.p>
            )}

            <motion.div className="modal-actions" variants={modalSectionVariants}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>Отмена</motion.button>
              <motion.button className="primary-button" type="submit" disabled={!canSubmit || saving} whileTap={{ scale: canSubmit && !saving ? 0.97 : 1 }}>
                <Plus size={17} />
                {saving ? 'Сохраняем…' : 'Добавить'}
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.form>
      </motion.div>
    </ModalPortal>
  );
}

// ─── Mini bar chart ──────────────────────────────────────────────────────────

const CHART_H = 72;

function SalesDynamicsChart({ rows, mode }) {
  const groups = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!r.record_date) return;
      const key =
        mode === 'weeks'
          ? weekKeyFromIso(r.record_date)
          : mode === 'months'
          ? r.record_date.slice(0, 7)
          : r.record_date;
      map[key] = (map[key] || 0) + Number(r.cash_amount ?? 0);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [rows, mode]);

  if (groups.length === 0) {
    return (
      <p style={{ textAlign: 'center', opacity: 0.38, fontSize: '0.85rem', padding: '24px 0' }}>
        Нет данных за период
      </p>
    );
  }

  const maxVal = Math.max(...groups.map(([, v]) => v), 1);

  return (
    <motion.div
      key={mode}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: CHART_H + 22, paddingTop: 6 }}
    >
      {groups.map(([key, val], i) => {
        const fillH = Math.max(4, Math.round((val / maxVal) * CHART_H));
        return (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0, gap: 4 }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: fillH }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.025 }}
              style={{
                width: '100%',
                borderRadius: 5,
                background: 'linear-gradient(180deg, var(--accent) 0%, rgba(119,101,227,0.45) 100%)',
                boxShadow: '0 2px 6px rgba(119,101,227,0.14)',
              }}
            />
            <span style={{ fontSize: 8, color: 'var(--muted)', whiteSpace: 'nowrap', letterSpacing: 0.2 }}>
              {dynamicsLabel(key, mode)}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}

function SalesMiniBars({ rows }) {
  const groups = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!r.record_date) return;
      map[r.record_date] = (map[r.record_date] || 0) + Number(r.cash_amount ?? 0);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  }, [rows]);

  if (groups.length === 0) return <div className="sales-mini-bars empty" />;
  const maxVal = Math.max(...groups.map(([, v]) => v), 1);

  return (
    <div className="sales-mini-bars" aria-hidden="true">
      {groups.map(([date, value], index) => (
        <motion.span
          key={date}
          initial={{ height: 4 }}
          animate={{ height: Math.max(8, Math.round((value / maxVal) * 38)) }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: index * 0.025 }}
        />
      ))}
    </div>
  );
}

// ─── Employee Detail Modal ───────────────────────────────────────────────────

function EmployeeSalesDetailModal({ employee, rows, period, setPeriod, layoutId, onClose, onUpdateRow, onDeleteRow }) {
  useModalScrollLock();
  const { showToast } = useToast();
  const [dynamicsMode, setDynamicsMode] = useState('days');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ record_date: '', deposits_count: '', cash_amount: '' });
  const [savingRow, setSavingRow] = useState(false);
  const [rowError, setRowError] = useState(null);

  const filtered = useMemo(() => {
    const cutoff = getPeriodStart(period);
    return rows.filter((r) => r.record_date >= cutoff);
  }, [rows, period]);

  const { deposits, cash } = useMemo(() => ({
    deposits: filtered.reduce((s, r) => s + (r.deposits_count ?? 0), 0),
    cash: filtered.reduce((s, r) => s + Number(r.cash_amount ?? 0), 0),
  }), [filtered]);

  const history = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dateCompare = (b.record_date ?? '').localeCompare(a.record_date ?? '');
      if (dateCompare !== 0) return dateCompare;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [filtered]);

  const isEmpty = filtered.length === 0;

  const startEdit = (row) => {
    setEditingId(row.id);
    setRowError(null);
    setEditForm({
      record_date: row.record_date ?? new Date().toISOString().slice(0, 10),
      deposits_count: String(row.deposits_count ?? 0),
      cash_amount: String(row.cash_amount ?? 0),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setRowError(null);
  };

  const saveEdit = async (row) => {
    if (savingRow) return;
    setSavingRow(true);
    setRowError(null);
    const payload = {
      record_date: editForm.record_date,
      deposits_count: Math.max(0, parseInt(editForm.deposits_count, 10) || 0),
      cash_amount: Math.max(0, parseFloat(editForm.cash_amount) || 0),
    };
    const { error } = await supabase.from('employee_sales').update(payload).eq('id', row.id);
    setSavingRow(false);
    if (error) {
      console.error('[Sales] update row error:', error);
      setRowError('Не удалось обновить запись.');
      return;
    }
    onUpdateRow({ ...row, ...payload });
    setEditingId(null);
    showToast('Продажа обновлена', 'success');
  };

  const deleteRow = async (row) => {
    if (savingRow) return;
    setSavingRow(true);
    setRowError(null);
    const { error } = await supabase.from('employee_sales').delete().eq('id', row.id);
    setSavingRow(false);
    if (error) {
      console.error('[Sales] delete row error:', error);
      setRowError('Не удалось удалить запись.');
      return;
    }
    onDeleteRow(row.id);
    showToast('Продажа удалена', 'success');
  };

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop report-detail-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.aside
          layoutId={layoutId}
          onClick={(e) => e.stopPropagation()}
          className="modal-shell modal-shell--large report-detail"
          role="dialog"
          aria-modal="true"
          transition={salesSharedTransition}
        >
          <motion.div className="report-detail-content" variants={modalContentVariants} initial="hidden" animate="show" exit="exit">

            {/* Header */}
            <motion.div className="report-detail-header sales-detail-header" variants={modalSectionVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div className="sales-emp-avatar" style={{ width: 42, height: 42, borderRadius: 14, fontSize: 14, flexShrink: 0 }}>
                  {initials(employee.name)}
                </div>
                <div>
                  <span className="eyebrow">Продажи · {period === 'week' ? getWeekRangeLabel() : getMonthLabel()}</span>
                  <h2 style={{ margin: '1px 0 0' }}>{employee.name}</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{employee.role}</p>
                </div>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            {/* Period toggle */}
            <motion.div className="sales-modal-switch" variants={modalSectionVariants}>
              {[['week', 'Неделя'], ['month', 'Месяц']].map(([p, label]) => (
                <button key={p} type="button" className={`qtc-pill${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
                  {label}
                </button>
              ))}
            </motion.div>

            {/* KPI row */}
            <motion.div className="sales-detail-kpi-grid" variants={modalSectionVariants}>
              <div className="sales-detail-kpi">
                <span className="sales-detail-kpi-label">Депозиты</span>
                <strong className="sales-detail-kpi-value">{isEmpty ? '—' : deposits}</strong>
              </div>
              <div className="sales-detail-kpi">
                <span className="sales-detail-kpi-label">Касса</span>
                <strong className="sales-detail-kpi-value">{isEmpty ? '$—' : formatCash(cash)}</strong>
              </div>
            </motion.div>

            {/* Chart */}
            <motion.div variants={modalSectionVariants}>
              <PremiumCard compact title="Динамика кассы">
                <div className="sales-modal-switch compact">
                  {[
                    ['days', 'По дням'],
                    ['weeks', 'По неделям'],
                    ['months', 'По месяцам'],
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={`qtc-pill${dynamicsMode === mode ? ' active' : ''}`}
                      onClick={() => setDynamicsMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <SalesDynamicsChart rows={filtered} mode={dynamicsMode} />
              </PremiumCard>
            </motion.div>

            {/* History */}
            <motion.div variants={modalSectionVariants} style={{ marginTop: 18 }}>
              <p className="sales-section-label">История</p>
              {rowError && (
                <p style={{ margin: '0 0 10px', color: 'var(--danger)', fontSize: '0.82rem' }}>{rowError}</p>
              )}
              {history.length === 0 ? (
                <p style={{ opacity: 0.38, fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>
                  Нет данных за выбранный период
                </p>
              ) : (
                <div className="sales-history-table">
                  {history.map((row) => (
                    <div key={row.id} className="sales-history-row">
                      {editingId === row.id ? (
                        <>
                          <input
                            className="sales-history-input"
                            type="date"
                            value={editForm.record_date}
                            onChange={(e) => setEditForm((f) => ({ ...f, record_date: e.target.value }))}
                          />
                          <input
                            className="sales-history-input short"
                            type="number"
                            min="0"
                            value={editForm.deposits_count}
                            onChange={(e) => setEditForm((f) => ({ ...f, deposits_count: e.target.value }))}
                          />
                          <input
                            className="sales-history-input cash"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.cash_amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, cash_amount: e.target.value }))}
                          />
                          <button className="sales-row-action" type="button" disabled={savingRow} onClick={() => saveEdit(row)} aria-label="Сохранить">
                            <Save size={14} />
                          </button>
                          <button className="sales-row-action" type="button" disabled={savingRow} onClick={cancelEdit} aria-label="Отмена">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="sales-history-date">{fmtDate(row.record_date)}</span>
                          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{row.deposits_count ?? 0}&thinsp;деп.</span>
                          <span className="sales-history-cash">{formatCash(row.cash_amount)}</span>
                          <button className="sales-row-action" type="button" onClick={() => startEdit(row)} aria-label="Редактировать">
                            <Pencil size={14} />
                          </button>
                          <button className="sales-row-action danger" type="button" disabled={savingRow} onClick={() => deleteRow(row)} aria-label="Удалить">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.button
              className="ghost-button full"
              style={{ marginTop: 22 }}
              variants={modalSectionVariants}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
            >
              Закрыть
            </motion.button>
          </motion.div>
        </motion.aside>
      </motion.div>
    </ModalPortal>
  );
}

// ─── Employee Sales Card ─────────────────────────────────────────────────────

function EmployeeSalesCard({ employee, rows, periodLabel, layoutId, onClick }) {
  const { deposits, cash } = useMemo(() => summarizeRows(rows), [rows]);

  const MAX_DEPOSITS = 30;
  const progress = Math.min(deposits / MAX_DEPOSITS, 1);
  const progressPercent = Math.round(progress * 100);

  return (
    <motion.div
      layout
      layoutId={layoutId}
      className="sales-emp-card"
      whileHover={{ y: -3, boxShadow: '0 18px 52px rgba(119,101,227,0.15)' }}
      whileTap={{ scale: 0.985 }}
      transition={salesSharedTransition}
      onClick={onClick}
      style={{ cursor: 'pointer', display: 'grid' }}
    >
      <div className="sales-emp-header sales-card-zone-head">
        <div className="sales-emp-avatar">{initials(employee.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sales-emp-name">
            {employee.name}
          </div>
          <div className="sales-emp-role">
            {employee.role}
          </div>
        </div>
      </div>

      <div className="sales-card-period">{periodLabel}</div>

      <div className="sales-emp-metrics">
        <div>
          <div className="sales-emp-number">{deposits}</div>
          <div className="sales-emp-caption">депозиты</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="sales-emp-number">{formatCash(cash)}</div>
          <div className="sales-emp-caption">касса</div>
        </div>
      </div>

      <SalesMiniBars rows={rows} />

      <div className="sales-emp-progress">
        <div className="sales-emp-progress-track">
          <motion.div
            className="sales-emp-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {progressPercent}%
        </span>
      </div>
    </motion.div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function SalesKpiCard({ label, value, range, icon: Icon, accent = false }) {
  return (
    <div className={`sales-kpi-card${accent ? ' sales-kpi-card--accent' : ''}`}>
      <div className="sales-kpi-head">
        <div className="sales-kpi-icon">{Icon ? <Icon size={16} /> : <BarChart2 size={16} />}</div>
        <div className="sales-kpi-label">{label}</div>
      </div>
      <motion.div
        key={value}
        className="sales-kpi-value"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {value}
      </motion.div>
      <div className="sales-kpi-range">{range}</div>
    </div>
  );
}

function SalesTopRanking({ ranking }) {
  if (ranking.length === 0) return null;
  return (
    <section className="sales-ranking">
      <div className="sales-ranking-head">
        <div>
          <span className="eyebrow">Live ranking</span>
          <h3>Топ-3 сотрудников</h3>
        </div>
        <Trophy size={18} />
      </div>
      <motion.div className="sales-ranking-list" layout>
        {ranking.map((item, index) => (
          <motion.div
            key={item.employee.id}
            layout
            className={`sales-rank-card sales-rank-card--${index + 1}`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={salesSharedTransition}
          >
            <div className="sales-rank-medal">{index + 1}</div>
            <div className="sales-rank-person">
              <strong>{item.employee.name}</strong>
              <span>{item.employee.role}</span>
            </div>
            <div className="sales-rank-values">
              <b>{formatCash(item.cash)}</b>
              <small>{item.deposits} деп.</small>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

// ─── Sales Page ──────────────────────────────────────────────────────────────

export function Sales({ employees, employeesLoading, organizationId }) {
  const [salesRows, setSalesRows] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [addOpen, setAddOpen] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [detailPeriod, setDetailPeriod] = useState('week');
  const [dateTick, setDateTick] = useState(() => new Date().toDateString());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDateTick(new Date().toDateString());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    // Fetch everything from week start (which is always <= month start)
    supabase
      .from('employee_sales')
      .select('id, employee_id, deposits_count, cash_amount, record_date')
      .eq('organization_id', organizationId)
      .gte('record_date', getWeekStart())
      .order('record_date', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setSalesRows(data ?? []);
        else console.error('[Sales] fetch error:', error);
        setSalesLoading(false);
      });
  }, [organizationId, dateTick]);

  // Also fetch month rows separately (month start may be before week start at start of month)
  const [monthRows, setMonthRows] = useState([]);
  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('employee_sales')
      .select('id, employee_id, deposits_count, cash_amount, record_date')
      .eq('organization_id', organizationId)
      .gte('record_date', getMonthStart())
      .order('record_date', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setMonthRows(data ?? []);
        else console.error('[Sales] month fetch error:', error);
      });
  }, [organizationId, dateTick]);

  // All rows for the full month window (month rows are superset when month > week)
  const allRows = useMemo(() => {
    // Merge: month rows contain all week rows (week ⊆ month in date terms — always true),
    // so just use monthRows for all aggregation, salesRows for week-only
    // Actually: week start >= month start always except at beginning of month.
    // Safest: union by id.
    const seen = new Set();
    const merged = [];
    [...monthRows, ...salesRows].forEach((r) => {
      if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
    });
    return merged;
  }, [monthRows, salesRows]);

  const selectedPeriodRowsByEmployee = useMemo(() => {
    const cutoff = getPeriodStart(period);
    const map = {};
    allRows.forEach((r) => {
      if (!r.record_date || r.record_date < cutoff) return;
      if (!map[r.employee_id]) map[r.employee_id] = [];
      map[r.employee_id].push(r);
    });
    return map;
  }, [allRows, period, dateTick]);

  const visibleEmployees = useMemo(
    () => employees.filter((emp) => (selectedPeriodRowsByEmployee[emp.id] ?? []).length > 0),
    [employees, selectedPeriodRowsByEmployee]
  );

  const periodLabel = period === 'week' ? getWeekRangeLabel() : `Месяц: ${getMonthLabel()}`;
  const periodRange = getPeriodRange(period);
  const weekRange = getPeriodRange('week');
  const monthRange = getPeriodRange('month');

  const topRanking = useMemo(() => {
    return visibleEmployees
      .map((employee) => {
        const totals = summarizeRows(selectedPeriodRowsByEmployee[employee.id] ?? []);
        return { employee, ...totals };
      })
      .sort((a, b) => {
        const cashDelta = b.cash - a.cash;
        if (cashDelta !== 0) return cashDelta;
        return b.deposits - a.deposits;
      })
      .slice(0, 3);
  }, [visibleEmployees, selectedPeriodRowsByEmployee]);

  const { weekDeposits, weekCash, monthDeposits, monthCash } = useMemo(
    () => aggregateSales(allRows),
    [allRows]
  );

  const loading = salesLoading || employeesLoading;
  const noSalesData = !loading && visibleEmployees.length === 0;

  const openDetail = (emp) => {
    setDetailEmployee(emp);
    setDetailPeriod(period); // sync period from page
  };

  const syncLocalSalesRow = (row) => {
    const upsert = (list, include) => {
      const without = list.filter((item) => item.id !== row.id);
      return include ? [row, ...without] : without;
    };
    setSalesRows((prev) => upsert(prev, row.record_date >= getWeekStart()));
    setMonthRows((prev) => upsert(prev, row.record_date >= getMonthStart()));
  };

  const removeLocalSalesRow = (rowId) => {
    setSalesRows((prev) => prev.filter((item) => item.id !== rowId));
    setMonthRows((prev) => prev.filter((item) => item.id !== rowId));
  };

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="employees-page-head">
        <div>
          <span className="eyebrow">Депозиты и касса по сотрудникам</span>
          <h2>Продажи</h2>
        </div>
        <motion.button
          className="primary-button"
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -2 }}
          onClick={() => setAddOpen(true)}
          disabled={employees.length === 0}
        >
          <Plus size={17} />
          Добавить
        </motion.button>
      </div>

      <div className="sales-kpi-grid">
        <SalesKpiCard label="Депозиты за неделю" value={loading ? '…' : String(weekDeposits)} range={weekRange} icon={CalendarDays} />
        <SalesKpiCard label="Касса за неделю" value={loading ? '…' : formatCash(weekCash)} range={weekRange} icon={BarChart2} accent />
        <SalesKpiCard label="Депозиты за месяц" value={loading ? '…' : String(monthDeposits)} range={monthRange} icon={CalendarDays} />
        <SalesKpiCard label="Касса за месяц" value={loading ? '…' : formatCash(monthCash)} range={monthRange} icon={BarChart2} accent />
      </div>

      <div className="sales-period-bar">
        <div>
          <span className="sales-section-label">Период</span>
          <strong className="sales-period-range">{periodLabel}</strong>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['week', 'Неделя'], ['month', 'Месяц']].map(([p, label]) => (
            <button key={p} type="button" className={`qtc-pill${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!loading && <SalesTopRanking ranking={topRanking} />}

      {loading ? (
        <div className="sales-empty-state">
          <p style={{ opacity: 0.45 }}>Загружаем данные…</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="sales-empty-state">
          <BarChart2 size={36} style={{ opacity: 0.18, marginBottom: 10 }} />
          <p style={{ fontWeight: 600, opacity: 0.6, marginBottom: 4 }}>Нет сотрудников</p>
          <p style={{ opacity: 0.38, fontSize: '0.875rem', maxWidth: 300, margin: 0 }}>
            Добавьте сотрудников во вкладке «Сотрудники», чтобы отслеживать продажи.
          </p>
        </div>
      ) : noSalesData ? (
        <div className="sales-empty-state">
          <BarChart2 size={36} style={{ opacity: 0.18, marginBottom: 10 }} />
          <p style={{ fontWeight: 600, opacity: 0.6, marginBottom: 4 }}>Пока нет данных</p>
          <p style={{ opacity: 0.38, fontSize: '0.875rem', maxWidth: 320, margin: 0 }}>
            Показатели продаж появятся после добавления данных.
          </p>
          <motion.button
            className="primary-button"
            type="button"
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -2 }}
            onClick={() => setAddOpen(true)}
            style={{ marginTop: 14 }}
          >
            <Plus size={17} />
            Добавить продажу
          </motion.button>
        </div>
      ) : (
        <motion.div
          className="sales-emp-grid"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055 } } }}
        >
          {visibleEmployees.map((emp) => (
            <motion.div
              key={emp.id}
              variants={{ hidden: { opacity: 0, y: 14, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } }}
              style={{ display: 'flex' }}
            >
              <EmployeeSalesCard
                employee={emp}
                rows={selectedPeriodRowsByEmployee[emp.id] ?? []}
                periodLabel={periodLabel}
                layoutId={`sales-employee-${emp.id}`}
                onClick={() => openDetail(emp)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {addOpen && (
          <AddSalesModal
            employees={employees}
            organizationId={organizationId}
            onClose={() => setAddOpen(false)}
            onSaved={syncLocalSalesRow}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detailEmployee && (
          <EmployeeSalesDetailModal
            employee={detailEmployee}
            rows={allRows.filter((r) => r.employee_id === detailEmployee.id)}
            period={detailPeriod}
            setPeriod={setDetailPeriod}
            layoutId={`sales-employee-${detailEmployee.id}`}
            onUpdateRow={syncLocalSalesRow}
            onDeleteRow={removeLocalSalesRow}
            onClose={() => setDetailEmployee(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
