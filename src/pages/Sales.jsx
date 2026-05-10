import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, Plus, X } from 'lucide-react';
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

function initials(name) {
  return (name ?? '').split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();
}

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
    const payload = {
      employee_id: form.employee_id,
      organization_id: organizationId,
      deposits_count: form.deposits_count !== '' ? parseInt(form.deposits_count, 10) : 0,
      cash_amount: form.cash_amount !== '' ? parseFloat(form.cash_amount) : 0,
      record_date: form.record_date,
    };
    const { data, error: err } = await supabase.from('employee_sales').insert(payload).select().single();
    setSaving(false);
    if (err) { setError(`Ошибка: ${err.message}`); return; }
    showToast('Показатели добавлены', 'success');
    onSaved(data);
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

function SalesDayChart({ rows }) {
  const days = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!r.record_date) return;
      map[r.record_date] = (map[r.record_date] || 0) + Number(r.cash_amount ?? 0);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [rows]);

  if (days.length === 0) {
    return (
      <p style={{ textAlign: 'center', opacity: 0.38, fontSize: '0.85rem', padding: '24px 0' }}>
        Нет данных за период
      </p>
    );
  }

  const maxVal = Math.max(...days.map(([, v]) => v), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: CHART_H + 22, paddingTop: 6 }}>
      {days.map(([date, val], i) => {
        const fillH = Math.max(4, Math.round((val / maxVal) * CHART_H));
        return (
          <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0, gap: 4 }}>
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
              {date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Employee Detail Modal ───────────────────────────────────────────────────

function EmployeeSalesDetailModal({ employee, rows, period, setPeriod, onClose }) {
  useModalScrollLock();

  const filtered = useMemo(() => {
    const cutoff = period === 'week' ? getWeekStart() : getMonthStart();
    return rows.filter((r) => r.record_date >= cutoff);
  }, [rows, period]);

  const { deposits, cash } = useMemo(() => ({
    deposits: filtered.reduce((s, r) => s + (r.deposits_count ?? 0), 0),
    cash: filtered.reduce((s, r) => s + Number(r.cash_amount ?? 0), 0),
  }), [filtered]);

  const history = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const d = r.record_date;
      if (!d) return;
      if (!map[d]) map[d] = { deposits: 0, cash: 0 };
      map[d].deposits += r.deposits_count ?? 0;
      map[d].cash += Number(r.cash_amount ?? 0);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const isEmpty = filtered.length === 0;

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop report-detail-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.aside
          onClick={(e) => e.stopPropagation()}
          className="modal-shell modal-shell--large report-detail"
          role="dialog"
          aria-modal="true"
          initial={modalMotion.initial}
          animate={modalMotion.animate}
          exit={modalMotion.exit}
          transition={modalMotion.transition}
        >
          <motion.div className="report-detail-content" variants={modalContentVariants} initial="hidden" animate="show" exit="exit">

            {/* Header */}
            <motion.div className="report-detail-header" variants={modalSectionVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div className="sales-emp-avatar" style={{ width: 42, height: 42, borderRadius: 14, fontSize: 14, flexShrink: 0 }}>
                  {initials(employee.name)}
                </div>
                <div>
                  <span className="eyebrow">Продажи · {period === 'week' ? 'Эта неделя' : 'Этот месяц'}</span>
                  <h2 style={{ margin: '1px 0 0' }}>{employee.name}</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{employee.role}</p>
                </div>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            {/* Period toggle */}
            <motion.div variants={modalSectionVariants} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {[['week', 'Неделя'], ['month', 'Месяц']].map(([p, label]) => (
                <button key={p} type="button" className={`qtc-pill${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
                  {label}
                </button>
              ))}
            </motion.div>

            {/* KPI row */}
            <motion.div variants={modalSectionVariants} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
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
              <PremiumCard compact title="Динамика кассы по дням">
                <SalesDayChart rows={filtered} />
              </PremiumCard>
            </motion.div>

            {/* History */}
            <motion.div variants={modalSectionVariants} style={{ marginTop: 18 }}>
              <p className="sales-section-label">История</p>
              {history.length === 0 ? (
                <p style={{ opacity: 0.38, fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>
                  Нет данных за выбранный период
                </p>
              ) : (
                <div className="sales-history-table">
                  {history.map(([date, { deposits: d, cash: c }]) => (
                    <div key={date} className="sales-history-row">
                      <span className="sales-history-date">{fmtDate(date)}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{d}&thinsp;деп.</span>
                      <span className="sales-history-cash">{formatCash(c)}</span>
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

function EmployeeSalesCard({ employee, rows, period, onClick }) {
  const { weekDeposits, weekCash, monthDeposits, monthCash } = useMemo(() => aggregateSales(rows), [rows]);

  const deposits = period === 'week' ? weekDeposits : monthDeposits;
  const cash = period === 'week' ? weekCash : monthCash;
  const hasData = deposits > 0 || cash > 0;

  const MAX_DEPOSITS = 30;
  const progress = Math.min(deposits / MAX_DEPOSITS, 1);

  return (
    <motion.div
      className="sales-emp-card"
      whileHover={{ y: -3, boxShadow: '0 18px 52px rgba(119,101,227,0.15)' }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
    >
      {/* Employee identity */}
      <div className="sales-emp-header">
        <div className="sales-emp-avatar">{initials(employee.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {employee.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {employee.role}
          </div>
        </div>
      </div>

      {/* Metrics */}
      {hasData ? (
        <>
          <div className="sales-emp-metrics">
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>{deposits}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>депозиты</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>{formatCash(cash)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>касса</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="sales-emp-progress" style={{ marginTop: 'auto' }}>
            <div className="sales-emp-progress-track">
              <motion.div
                className="sales-emp-progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {deposits} / {MAX_DEPOSITS}
            </span>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0 10px' }}>
          <p style={{ opacity: 0.35, fontSize: '0.82rem', textAlign: 'center', margin: 0 }}>Нет данных за период</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function SalesKpiCard({ label, value, accent = false }) {
  return (
    <div className={`sales-kpi-card${accent ? ' sales-kpi-card--accent' : ''}`}>
      <div className="sales-kpi-label">{label}</div>
      <div className="sales-kpi-value">{value}</div>
    </div>
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
  }, [organizationId]);

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
  }, [organizationId]);

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

  const rowsByEmployee = useMemo(() => {
    const map = {};
    allRows.forEach((r) => {
      if (!map[r.employee_id]) map[r.employee_id] = [];
      map[r.employee_id].push(r);
    });
    return map;
  }, [allRows]);

  const { weekDeposits, weekCash, monthDeposits, monthCash } = useMemo(
    () => aggregateSales(allRows),
    [allRows]
  );

  const loading = salesLoading || employeesLoading;
  const noSalesData = !loading && allRows.length === 0;

  const openDetail = (emp) => {
    setDetailEmployee(emp);
    setDetailPeriod(period); // sync period from page
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

      {/* ── KPI Grid (always shows week + month, not period-dependent) ── */}
      <div className="sales-kpi-grid">
        <SalesKpiCard label="Депозиты за неделю" value={loading ? '…' : String(weekDeposits)} />
        <SalesKpiCard label="Касса за неделю" value={loading ? '…' : formatCash(weekCash)} accent />
        <SalesKpiCard label="Депозиты за месяц" value={loading ? '…' : String(monthDeposits)} />
        <SalesKpiCard label="Касса за месяц" value={loading ? '…' : formatCash(monthCash)} accent />
      </div>

      {/* ── Period switch + employee grid ────────────────────────────── */}
      <div className="sales-period-bar">
        <span className="sales-section-label">По сотрудникам</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['week', 'Неделя'], ['month', 'Месяц']].map(([p, label]) => (
            <button key={p} type="button" className={`qtc-pill${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
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
        </div>
      ) : (
        <motion.div
          className="sales-emp-grid"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055 } } }}
        >
          {employees.map((emp) => (
            <motion.div
              key={emp.id}
              variants={{ hidden: { opacity: 0, y: 14, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } }}
              style={{ display: 'flex' }}
            >
              <EmployeeSalesCard
                employee={emp}
                rows={rowsByEmployee[emp.id] ?? []}
                period={period}
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
            onSaved={(row) => {
              setSalesRows((prev) => [row, ...prev]);
              setMonthRows((prev) => [row, ...prev]);
            }}
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
            onClose={() => setDetailEmployee(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
