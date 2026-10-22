import { useEffect, useState } from "react";
import { api } from "../api.js";

const PER = 10;

export default function History({ openDetails }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ meetings: [], total: 0 });
  const [err, setErr] = useState("");

  useEffect(() => {
    const url = `/meetings?limit=${PER}&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}`;
    const t = setTimeout(() => api(url).then(setData).catch((e) => setErr(e.message)), 300); // wait for typing to stop
    return () => clearTimeout(t);
  }, [q, status, page]);

  const pages = Math.max(1, Math.ceil(data.total / PER));

  return (
    <div>
      <h2>Meeting history</h2>
      <div className="row">
        <input aria-label="Search by title" placeholder="Search by title word" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="ended">Ended</option>
        </select>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="card">
        {data.meetings.map((m) => (
          <div className="hrow" key={m._id}>
            <div>
              <b>{m.title}</b>
              <div className="muted small">{new Date(m.createdAt).toLocaleString()} {m.aiStatus === "done" && "· 🧠 summary ready"}</div>
            </div>
            <span className={`pill ${m.status}`}>{m.status}</span>
            <button className="ghost" onClick={() => openDetails(m._id)}>Details</button>
          </div>
        ))}
        {data.meetings.length === 0 && <p className="muted">No meetings found.</p>}
      </div>
      <div className="row">
        <button className="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
        <span className="small muted">Page {page} of {pages} · {data.total} meetings</span>
        <button className="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
      </div>
    </div>
  );
}
