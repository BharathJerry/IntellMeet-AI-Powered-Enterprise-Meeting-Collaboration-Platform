import { useEffect, useState } from "react";
import { api } from "../api.js";

const STATUS = [["todo", "To Do", "#8a8fa8"], ["in_progress", "In Progress", "#7367f0"], ["done", "Done", "#22c55e"]];

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { api("/analytics/overview").then(setD).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="err">{err}</div>;
  if (!d) return <p className="muted">Loading…</p>;

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
    ["Meetings", d.meetings.total],
    ["Tasks", d.tasks.total],
    ["Completion", `${d.tasks.completionRate}%`],
    ["AI summaries", d.ai.summaries],
  ];

  return (
    <div>
      <div className="row">
        <h2>Dashboard</h2>
        <button className="ghost" onClick={exportCsv}>⬇ Export CSV</button>
      </div>

      <div className="stats">
        {stats.map(([label, value]) => (
          <div className="card stat" key={label}><span className="muted small">{label}</span><b>{value}</b></div>
        ))}
      </div>

      <div className="charts">
        <div className="card">
          <h4>Meetings, last 14 days</h4>
          <svg viewBox="0 0 280 110" role="img" aria-label="Bar chart of meetings per day for the last 14 days">
            {days.map((x, i) => {
              const h = (x.count / max) * 80;
              return (
                <g key={x.date}>
                  <rect x={i * 20 + 2} y={90 - h} width="14" height={h} rx="3" fill="#7367f0"><title>{x.date}: {x.count}</title></rect>
                  <text x={i * 20 + 9} y="104" fontSize="7" textAnchor="middle" fill="#8a8fa8">{x.date.slice(8)}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="card">
          <h4>Tasks by status</h4>
          {STATUS.map(([key, label, color]) => (
            <div className="hbar" key={key}>
              <span className="small">{label} ({d.tasks.byStatus[key]})</span>
              <div className="track"><div style={{ width: `${(d.tasks.byStatus[key] / Math.max(1, d.tasks.total)) * 100}%`, background: color }} /></div>
            </div>
          ))}
          <h4>AI action items</h4>
          <div className="hbar">
            <span className="small">Turned into tasks ({items.converted}/{items.total})</span>
            <div className="track"><div style={{ width: `${(items.converted / Math.max(1, items.total)) * 100}%`, background: "#1f6bff" }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
