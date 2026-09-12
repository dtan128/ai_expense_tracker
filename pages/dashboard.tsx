import { GetServerSideProps } from "next";
import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { isAuthenticated } from "@/lib/auth";
import { getMonthSummary, listExpenses, MonthSummary } from "@/lib/db";
import { CATEGORIES } from "@/lib/categories";
import { currentMonth, shiftMonth, formatMonthLabel, formatDayLabel, buildCalendarWeeks, todayDateString } from "@/lib/date";
import { categoryColor } from "@/lib/categoryStyle";

interface ExpenseRow {
  id: string;
  amount: number;
  currency: string;
  merchant: string | null;
  description: string | null;
  category: string;
  transaction_date: string;
  status: string;
}

interface SummaryWithTrend extends MonthSummary {
  previousTotal: number;
}

interface DashboardProps {
  initialMonth: string;
  initialSummary: SummaryWithTrend;
  initialExpenses: ExpenseRow[];
}

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (ctx) => {
  if (!isAuthenticated(ctx.req)) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const month = currentMonth();
  const [summary, previous, { data }] = await Promise.all([
    getMonthSummary(month),
    getMonthSummary(shiftMonth(month, -1)),
    listExpenses({ month, category: "all" }),
  ]);

  return {
    props: {
      initialMonth: month,
      initialSummary: { ...summary, previousTotal: previous.total },
      initialExpenses: (data ?? []) as ExpenseRow[],
    },
  };
};

/** Animates a number from its previous value to a new target over ~600ms. */
function useCountUp(target: number) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    const duration = 600;
    const start = performance.now();
    let raf: number;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return display;
}

export default function Dashboard({ initialMonth, initialSummary, initialExpenses }: DashboardProps) {
  const [month, setMonth] = useState(initialMonth);
  const [summary, setSummary] = useState<SummaryWithTrend>(initialSummary);
  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialExpenses);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"daily" | "cumulative">("daily");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ amount: "", merchant: "", category: "Other" });

  useEffect(() => {
    // One orchestrated entrance, not scattered per-element fades.
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const animatedTotal = useCountUp(summary.total);

  const loadData = useCallback(async (m: string, cat: string) => {
    setLoading(true);
    try {
      const [summaryRes, expensesRes] = await Promise.all([
        fetch(`/api/summary?month=${m}`).then((r) => r.json()),
        fetch(`/api/expenses?month=${m}&category=${cat}`).then((r) => r.json()),
      ]);
      setSummary(summaryRes);
      setExpenses(expensesRes.expenses ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (month === initialMonth && categoryFilter === "all") return; // already have SSR data
    loadData(month, categoryFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, categoryFilter]);

  function goToMonth(delta: number) {
    setMonth((m) => shiftMonth(m, delta));
    setSelectedDay(null);
  }

  function toggleCategoryFilter(cat: string) {
    setCategoryFilter((current) => (current === cat ? "all" : cat));
  }

  function toggleDay(date: string) {
    setSelectedDay((current) => (current === date ? null : date));
  }

  function clearFilters() {
    setCategoryFilter("all");
    setSelectedDay(null);
  }

  function startEdit(row: ExpenseRow) {
    setEditingId(row.id);
    setEditDraft({
      amount: String(Math.abs(row.amount)),
      merchant: row.merchant ?? row.description ?? "",
      category: row.category,
    });
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(editDraft.amount),
        merchant: editDraft.merchant,
        category: editDraft.category,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      loadData(month, categoryFilter);
    }
  }

  async function removeExpense(id: string) {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) loadData(month, categoryFilter);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const maxCategoryTotal = Math.max(1, ...summary.byCategory.map((c) => c.total));

  const dayTotalMap = new Map(summary.byDay.map((d) => [d.date, d.total]));
  const maxDayTotal = Math.max(1, ...summary.byDay.map((d) => d.total));
  const calendarWeeks = buildCalendarWeeks(month);
  const today = todayDateString();

  const visibleExpenses = selectedDay
    ? expenses.filter((e) => e.transaction_date === selectedDay)
    : expenses;

  const dailyData = summary.byDay.map((d) => ({ day: formatDayLabel(d.date), total: d.total }));
  let running = 0;
  const cumulativeData = summary.byDay.map((d) => {
    running += d.total;
    return { day: formatDayLabel(d.date), total: running };
  });
  const chartData = chartMode === "daily" ? dailyData : cumulativeData;

  const delta = summary.previousTotal > 0
    ? ((summary.total - summary.previousTotal) / summary.previousTotal) * 100
    : null;

  return (
    <div className={`dash ${mounted ? "dash-mounted" : ""}`}>
      <header className="dash-header">
        <span className="dash-title">Expenses</span>
        <div className="month-nav">
          <button className="btn btn-ghost" onClick={() => goToMonth(-1)} aria-label="Previous month">‹</button>
          <span className="month-label">{formatMonthLabel(month)}</span>
          <button className="btn btn-ghost" onClick={() => goToMonth(1)} aria-label="Next month">›</button>
        </div>
        <button className="btn btn-ghost" onClick={logout}>Log out</button>
      </header>

      <section className="hero">
        <p className="hero-label">Total this month</p>
        <p className="hero-total">${animatedTotal.toFixed(2)}</p>
        {delta !== null && (
          <p className={`hero-delta ${delta >= 0 ? "up" : "down"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs last month
          </p>
        )}
        <div className="hero-rule" aria-hidden="true" />
      </section>

      <section className="panel">
        <h2 className="panel-title">By category</h2>
        <p className="panel-hint">Tap a category to filter the list below.</p>
        {summary.byCategory.length === 0 ? (
          <p className="empty-note">Nothing logged yet this month.</p>
        ) : (
          <div className="bar-list">
            {summary.byCategory.map((c) => {
              const active = categoryFilter === c.category;
              return (
                <button
                  key={c.category}
                  className={`bar-row ${active ? "bar-row-active" : ""}`}
                  onClick={() => toggleCategoryFilter(c.category)}
                  type="button"
                >
                  <span className="bar-label">
                    <span className="cat-dot" style={{ background: categoryColor(c.category) }} />
                    {c.category}
                  </span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(c.total / maxCategoryTotal) * 100}%`,
                        background: categoryColor(c.category),
                      }}
                    />
                  </div>
                  <span className="bar-amount">${c.total.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2 className="panel-title">Spend over time</h2>
          <div className="segmented">
            <button
              className={chartMode === "daily" ? "active" : ""}
              onClick={() => setChartMode("daily")}
              type="button"
            >
              Daily
            </button>
            <button
              className={chartMode === "cumulative" ? "active" : ""}
              onClick={() => setChartMode("cumulative")}
              type="button"
            >
              Cumulative
            </button>
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="empty-note">No data to chart yet.</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#DAD6C7" vertical={false} />
                <XAxis dataKey="day" stroke="#8A8672" fontSize={11} />
                <YAxis stroke="#8A8672" fontSize={11} width={48} />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Spent"]} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#a6402f"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#a6402f" }}
                  activeDot={{ r: 5 }}
                  animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Calendar</h2>
        <p className="panel-hint">Darker days cost more. Tap a day to see just that day&apos;s transactions.</p>
        <div className="calendar">
          <div className="calendar-weekday-row">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((wd) => (
              <span key={wd} className="calendar-weekday">{wd}</span>
            ))}
          </div>
          {calendarWeeks.map((week, wi) => (
            <div className="calendar-week" key={wi}>
              {week.map((cell, ci) => {
                if (!cell.date) {
                  return <div key={ci} className="calendar-cell calendar-cell-empty" />;
                }
                const total = dayTotalMap.get(cell.date) ?? 0;
                const intensity = total > 0 ? 0.15 + 0.65 * (total / maxDayTotal) : 0;
                const isToday = cell.date === today;
                const isSelected = cell.date === selectedDay;
                return (
                  <button
                    key={ci}
                    type="button"
                    className={`calendar-cell ${isToday ? "calendar-cell-today" : ""} ${isSelected ? "calendar-cell-selected" : ""}`}
                    style={total > 0 ? { background: `rgba(166, 64, 47, ${intensity})` } : undefined}
                    onClick={() => toggleDay(cell.date!)}
                    title={total > 0 ? `$${total.toFixed(2)}` : "No spending"}
                  >
                    <span className="calendar-day-num">{cell.day}</span>
                    {total > 0 && <span className="calendar-day-amount">${Math.round(total)}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2 className="panel-title">Transactions</h2>
          <select className="select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {(categoryFilter !== "all" || selectedDay) && (
          <p className="filter-status">
            Showing {categoryFilter !== "all" ? categoryFilter : "all categories"}
            {selectedDay ? ` · ${formatDayLabel(selectedDay)}` : ""}
            {" — "}
            <button className="filter-clear" onClick={clearFilters} type="button">Clear</button>
          </p>
        )}

        {loading && <p className="empty-note">Loading…</p>}
        {!loading && visibleExpenses.length === 0 && <p className="empty-note">No transactions match this filter.</p>}

        <ul className="txn-list">
          {visibleExpenses.map((row) => (
            <li className="txn-row-wrap" key={row.id}>
              {editingId === row.id ? (
                <div className="txn-row txn-edit">
                  <input
                    className="input"
                    value={editDraft.merchant}
                    onChange={(e) => setEditDraft((d) => ({ ...d, merchant: e.target.value }))}
                    placeholder="Merchant / description"
                  />
                  <input
                    className="input input-amount"
                    type="number"
                    step="0.01"
                    value={editDraft.amount}
                    onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                  />
                  <select
                    className="select"
                    value={editDraft.category}
                    onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary" onClick={() => saveEdit(row.id)}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <div className="txn-row">
                  <span className="txn-date">{formatDayLabel(row.transaction_date)}</span>
                  <span className="txn-desc">{row.merchant ?? row.description ?? "—"}</span>
                  <span className="txn-category">
                    <span className="cat-dot" style={{ background: categoryColor(row.category) }} />
                    {row.category}
                  </span>
                  <span className="txn-amount">{row.currency} {Math.abs(row.amount).toFixed(2)}</span>
                  <span className="txn-actions">
                    <button className="btn btn-text" onClick={() => startEdit(row)}>Edit</button>
                    <button className="btn btn-text btn-danger" onClick={() => removeExpense(row.id)}>Delete</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
