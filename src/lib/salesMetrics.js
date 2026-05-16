// Returns YYYY-MM-DD for the Monday of the current local week
export function getWeekStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Returns YYYY-MM-01 for the first of the current local month
export function getMonthStart() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// Aggregates raw employee_sales rows into week / month totals.
// Comparison is purely on the YYYY-MM-DD record_date string — no timezone math.
export function aggregateSales(rows = []) {
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  let weekDeposits = 0, weekCash = 0;
  let monthDeposits = 0, monthCash = 0;

  for (const r of rows) {
    const d = r.record_date;
    if (!d) continue;
    if (d >= monthStart) {
      monthDeposits += r.deposits_count ?? 0;
      monthCash += Number(r.cash_amount ?? 0);
    }
    if (d >= weekStart) {
      weekDeposits += r.deposits_count ?? 0;
      weekCash += Number(r.cash_amount ?? 0);
    }
  }

  return { weekDeposits, weekCash, monthDeposits, monthCash };
}

// Formats a numeric amount as "$1 234 567" (no decimals)
export function formatCash(amount) {
  if (!amount && amount !== 0) return '$—';
  return '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}
