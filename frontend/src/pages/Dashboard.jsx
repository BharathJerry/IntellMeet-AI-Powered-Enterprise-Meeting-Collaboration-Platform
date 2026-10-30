import { useEffect, useState } from "react";
import { api } from "../api.js";

const STATUS = [["todo", "To Do", "#8a95a6"], ["in_progress", "In Progress", "#356ae6"], ["done", "Done", "#16845b"]];

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { api("/analytics/overview").then(setD).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="dashboard-page"><div className="err" role="alert">{err}</div></div>;
  if (!d) return <div className="dashboard-page"><div className="dashboard-loading"><span className="history-loading-mark" aria-hidden="true" /><p className="muted">Preparing your workspace insights…</p></div></div>;

  const days = d.meetings.perDay;
  const max = Math.max(1, ...days.map((x) => x.count));
  const { items } = { items: d.ai.actionItems };

  const exportCsv = () => {
    const rows = [
      ["metric", "value"],
      ["meetings_total", d.meetings.total],
      ["tasks_total", d.tasks.total],
      ["task_completion_percent", d.tasks.completionRate],
      ["ai_summaries", d.ai.summaries],
      ["action_items_total", items.total],
      ["action_items_converted", items.converted],
      ...days.map((x) => [`meetings_${x.date}`, x.count]),
    ];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "intellmeet-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    ["Meetings", d.meetings.total, "◷", "Conversations held"],
    ["Tasks", d.tasks.total, "✓", "Across all boards"],
    ["Completion", `${d.tasks.completionRate}%`, "↗", "Tasks completed"],
    ["AI summaries", d.ai.summaries, "✦", "Generated from meetings"],
  ];

  return (
    <div className="dashboard-page">
      <header className="page-heading dashboard-heading">
        <div><span className="page-eyebrow">WORKSPACE OVERVIEW</span><h2>Dashboard</h2><p className="muted">A clear view of your team’s meeting and task activity.</p></div>
        <button className="ghost" onClick={exportCsv}><span aria-hidden="true">↓</span> Export report</button>
      </header>

      <div className="stats">
        {stats.map(([label, value, icon, caption]) => (
          <div className="card stat dashboard-stat" key={label}>
            <div className="dashboard-stat-top"><span>{label}</span><span className="dashboard-stat-icon" aria-hidden="true">{icon}</span></div>
            <b>{value}</b>
            <span className="muted small">{caption}</span>
          </div>
        ))}
      </div>

      <div className="charts dashboard-charts">
        <section className="card dashboard-chart-card">
          <div className="dashboard-card-heading"><div><span className="page-eyebrow">ACTIVITY</span><h3>Meetings over time</h3></div><span className="dashboard-period">Last 14 days</span></div>
          <svg viewBox="0 0 280 110" role="img" aria-label="Bar chart of meetings per day for the last 14 days">
            {days.map((x, i) => {
              const h = (x.count / max) * 80;
              return (
                <g key={x.date}>
                  <rect x={i * 20 + 2} y={90 - h} width="14" height={h} rx="3" fill="#356ae6"><title>{x.date}: {x.count}</title></rect>
                  <text x={i * 20 + 9} y="104" fontSize="7" textAnchor="middle" fill="#8a8fa8">{x.date.slice(8)}</text>
                </g>
              );
            })}
          </svg>
        </section>

        <section className="card dashboard-chart-card">
          <div className="dashboard-card-heading"><div><span className="page-eyebrow">TEAM PROGRESS</span><h3>Task breakdown</h3></div></div>
          {STATUS.map(([key, label, color]) => (
            <div className={`hbar dashboard-hbar dashboard-hbar-${key}`} key={key}>
              <div className="dashboard-progress-label"><span>{label}</span><b>{d.tasks.byStatus[key]}</b></div>
              <div className="track"><div style={{ width: `${(d.tasks.byStatus[key] / Math.max(1, d.tasks.total)) * 100}%`, background: color }} /></div>
            </div>
          ))}
          <div className="dashboard-ai-progress">
            <div className="dashboard-card-heading"><div><span className="page-eyebrow">AI FOLLOW-THROUGH</span><h3>Action items converted</h3></div><span className="dashboard-ai-icon" aria-hidden="true">✦</span></div>
            <div className="dashboard-progress-label"><span>Converted to tasks</span><b>{items.converted} / {items.total}</b></div>
            <div className="track"><div style={{ width: `${(items.converted / Math.max(1, items.total)) * 100}%`, background: "#356ae6" }} /></div>
          </div>
        </section>
      </div>
    </div>
  );
}
