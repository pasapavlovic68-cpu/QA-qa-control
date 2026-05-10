import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { PremiumCard, Stagger } from '../components/shared.jsx';
import { modalMotion, modalContentVariants, modalSectionVariants, useModalScrollLock, ModalPortal } from '../components/modal.jsx';
import { aggregateSales, formatCash, getWeekStart, getMonthStart } from '../lib/salesMetrics.js';
import { useToast } from '../components/Toast.jsx';

// ─── Add Sales Modal ────────────────────────────────────────────────────────

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
                <span className="eyebrow">Показатели продаж</span>
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
                <span>Депозиты (шт.)</span>
                <input type="number" min="0" placeholder="0" value={form.deposits_count} onChange={(e) => setForm((f) => ({ ...f, deposits_count: e.target.value }))} />
              </label>
              <label>
                <span>Сумма ($)</span>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.cash_amount} onChange={(e) => setForm((f) => ({ ...f, cash_amount: e.target.value }))} />
              </label>
            </motion.div>

            {error && (
              <motion.p variants={modalSectionVariants} style={{ fontSize: '0.82rem', color: '#e05c5c', textAlign: 'center', marginBottom: 4 }}>
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

// ─── Sales Day Chart (vertical bars) ───────────────────────────────────────

const MAX_H = 80;

function SalesDayChart({ rows }) {
  const days = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!r.record_date) return;
      map[r.record_date] = (map[r.record_date] || 0) + Number(r.cash_amount ?? 0);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [rows]);

  if (days.length === 0) return <p style={{ opacity: 0.4, fontSize: '0.85rem', padding: '12px 0' }}>Нет данных за период.</p>;

  const maxVal = Math.max(...days.map(([, v]) => v), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: MAX_H + 28, paddingTop: 8 }}>
      {days.map(([date, val]) => {
        const fillH = Math.max(4, Math.round((val / maxVal) * MAX_H));
        const label = date.slice(5); // MM-DD
        return (
          <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0, gap: 4 }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: fillH }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: '100%',
                borderRadius: 6,
                background: 'linear-gradient(180deg, var(--accent) 0%, rgba(119,101,227,0.55) 100%)',
                boxShadow: '0 2px 8px rgba(119,101,227,0.18)',
              }}
            />
            <span style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Employee Sales Detail Modal ────────────────────────────────────────────

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
            <motion.div className="report-detail-header" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Продажи</span>
                <h2>{employee.name}</h2>
                <p>{employee.role}</p>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            {/* Period toggle */}
            <motion.div variants={modalSectionVariants} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {['week', 'month'].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`qtc-pill${period === p ? ' active' : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === 'week' ? 'Эта неделя' : 'Этот месяц'}
                </button>
              ))}
            </motion.div>

            {/* KPI row */}
            <motion.div variants={modalSectionVariants} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <PremiumCard compact title="Депозиты">
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.15 }}>{deposits}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>за период</div>
              </PremiumCard>
              <PremiumCard compact title="Сумма">
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.15 }}>{formatCash(cash)}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>за период</div>
              </PremiumCard>
            </motion.div>

            {/* Chart */}
            <motion.div variants={modalSectionVariants}>
              <PremiumCard compact title="Динамика по дням">
                <SalesDayChart rows={filtered} />
              </PremiumCard>
            </motion.div>

            {/* History table */}
            <motion.div variants={modalSectionVariants} style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10, letterSpacing: 0.3, textTransform: 'uppercase' }}>История</h3>
              {history.length === 0 ? (
                <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Нет записей за период.</p>
              ) : (
                <div className="sales-history-table">
                  {history.map(([date, { deposits: d, cash: c }]) => (
                    <div key={date} className="sales-history-row">
                      <span className="sales-history-date">{date}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{d} деп.</span>
                      <span className="sales-history-cash">{formatCash(c)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.button className="ghost-button full report-back-button" variants={modalSectionVariants} whileTap={{ scale: 0.98 }} onClick={onClose}>
              Закрыть
            </motion.button>
          </motion.div>
        </motion.aside>
      </motion.div>
    </ModalPortal>
  );
}

// ─── Employee Sales Card ────────────────────────────────────────────────────

function EmployeeSalesCard({ employee, rows, period, onClick }) {
  const { weekDeposits, weekCash, monthDeposits, monthCash } = useMemo(() => aggregateSales(rows), [rows]);

  const deposits = period === 'week' ? weekDeposits : monthDeposits;
  const cash = period === 'week' ? weekCash : monthCash;

  const maxDeposits = 30;
  const progress = Math.min(deposits / maxDeposits, 1);

  const cashTone = cash >= 5000 ? 'var(--success)' : cash >= 2000 ? 'var(--warn)' : 'var(--accent)';

  return (
    <motion.div
      className="sales-emp-card"
      whileHover={{ y: -3, boxShadow: '0 16px 48px rgba(119,101,227,0.16)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="sales-emp-header">
        <div className="sales-emp-avatar">
          {employee.name.split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{employee.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{employee.role}</div>
        </div>
        <TrendingUp size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
      </div>

      <div className="sales-emp-metrics">
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>{deposits}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>депозиты</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: cashTone, lineHeight: 1.1 }}>{formatCash(cash)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>сумма</div>
        </div>
      </div>

      <div className="sales-emp-progress">
        <div className="sales-emp-progress-track">
          <motion.div
            className="sales-emp-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{deposits}/{maxDeposits}</span>
      </div>
    </motion.div>
  );
}

// ─── KPI Summary Card ───────────────────────────────────────────────────────

function SalesKpiCard({ label, value, sub }) {
  return (
    <div className="sales-kpi-card">
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Sales Page ─────────────────────────────────────────────────────────────

export function Sales({ employees, employeesLoading, organizationId }) {
  const [salesRows, setSalesRows] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [addOpen, setAddOpen] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [detailPeriod, setDetailPeriod] = useState('week');

  useEffect(() => {
    if (!organizationId) return;
    const cutoff = getWeekStart() < getMonthStart() ? getWeekStart() : getMonthStart();
    supabase
      .from('employee_sales')
      .select('id, employee_id, deposits_count, cash_amount, record_date')
      .eq('organization_id', organizationId)
      .gte('record_date', cutoff)
      .order('record_date', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setSalesRows(data ?? []);
        else console.error('[Sales] fetch error:', error);
        setSalesLoading(false);
      });
  }, [organizationId]);

  const rowsByEmployee = useMemo(() => {
    const map = {};
    salesRows.forEach((r) => {
      if (!map[r.employee_id]) map[r.employee_id] = [];
      map[r.employee_id].push(r);
    });
    return map;
  }, [salesRows]);

  const { weekDeposits, weekCash, monthDeposits, monthCash } = useMemo(
    () => aggregateSales(salesRows),
    [salesRows]
  );

  const deposits = period === 'week' ? weekDeposits : monthDeposits;
  const cash = period === 'week' ? weekCash : monthCash;
  const avgDeposits = employees.length > 0 ? Math.round((deposits / employees.length) * 10) / 10 : 0;
  const avgCash = employees.length > 0 ? Math.round(cash / employees.length) : 0;

  return (
    <>
      {/* Header */}
      <div className="employees-page-head">
        <div>
          <span className="eyebrow">Коммерческие результаты</span>
          <h2>Продажи</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Period pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['week', 'month'].map((p) => (
              <button key={p} type="button" className={`qtc-pill${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
                {p === 'week' ? 'Эта неделя' : 'Этот месяц'}
              </button>
            ))}
          </div>
          <motion.button className="primary-button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={() => setAddOpen(true)}>
            <Plus size={17} />
            Добавить
          </motion.button>
        </div>
      </div>

      {/* KPI summary */}
      <Stagger className="sales-kpi-grid">
        <SalesKpiCard label="Депозиты" value={salesLoading ? '…' : String(deposits)} sub={`всего за ${period === 'week' ? 'неделю' : 'месяц'}`} />
        <SalesKpiCard label="Сумма" value={salesLoading ? '…' : formatCash(cash)} sub={`всего за ${period === 'week' ? 'неделю' : 'месяц'}`} />
        <SalesKpiCard label="Сред. депозиты" value={salesLoading ? '…' : String(avgDeposits)} sub="на сотрудника" />
        <SalesKpiCard label="Сред. сумма" value={salesLoading ? '…' : formatCash(avgCash)} sub="на сотрудника" />
      </Stagger>

      {/* Employee sales grid */}
      {employeesLoading || salesLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <p style={{ opacity: 0.45, fontSize: '0.95rem' }}>Загружаем данные…</p>
        </div>
      ) : employees.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 8, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, opacity: 0.65, fontSize: '1rem' }}>Нет сотрудников</p>
          <p style={{ opacity: 0.4, fontSize: '0.875rem', maxWidth: 320 }}>Добавьте сотрудников во вкладке «Сотрудники», чтобы отслеживать продажи.</p>
        </div>
      ) : (
        <motion.div className="sales-emp-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
          {employees.map((emp) => (
            <motion.div key={emp.id} variants={{ hidden: { opacity: 0, y: 16, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } }}>
              <EmployeeSalesCard
                employee={emp}
                rows={rowsByEmployee[emp.id] ?? []}
                period={period}
                onClick={() => { setDetailEmployee(emp); setDetailPeriod(period); }}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {addOpen && (
          <AddSalesModal
            employees={employees}
            organizationId={organizationId}
            onClose={() => setAddOpen(false)}
            onSaved={(row) => setSalesRows((prev) => [row, ...prev])}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detailEmployee && (
          <EmployeeSalesDetailModal
            employee={detailEmployee}
            rows={salesRows.filter((r) => r.employee_id === detailEmployee.id)}
            period={detailPeriod}
            setPeriod={setDetailPeriod}
            onClose={() => setDetailEmployee(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
