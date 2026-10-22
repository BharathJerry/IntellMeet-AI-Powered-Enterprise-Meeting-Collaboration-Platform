import { useEffect, useState } from "react";
import { api } from "../api.js";

const PER = 10;

export default function History({ openDetails }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ meetings: [], total: 0 });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const url = `/meetings?limit=${PER}&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}`;

    setLoading(true);
    setErr("");
    const timer = setTimeout(() => {
      api(url)
        .then((result) => {
          if (active) setData(result);
        })
        .catch((error) => {
          if (active) setErr(error.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, status, page, reload]);

  const pages = Math.max(1, Math.ceil(data.total / PER));
  const hasFilters = Boolean(q || status);

  const clearFilters = () => {
    setQ("");
    setStatus("");
    setPage(1);
  };

  return (
    <div className="history-page">
      <header className="history-heading">
        <div>
          <span className="history-eyebrow">YOUR MEETINGS</span>
          <h2>Meeting history</h2>
          <p className="muted">Pick up where your conversations left off.</p>
        </div>
        <div className="history-total" aria-label={`${data.total} meetings in your history`}>
          <span className="history-total-icon" aria-hidden="true">◷</span>
          <span><b>{data.total}</b><small>meetings saved</small></span>
        </div>
      </header>

      <section className="history-toolbar" aria-label="Search and filter meetings">
        <label className="history-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search by title"
            placeholder="Search meetings by title"
            value={q}
            onChange={(event) => { setQ(event.target.value); setPage(1); }}
          />
        </label>
        <label className="history-status">
          <span className="muted small">Show</span>
          <select aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All meetings</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
          </select>
        </label>
      </section>

      {err && (
        <div className="history-error" role="alert">
          <span>{err}</span>
          <button className="ghost" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </div>
      )}

      <section className="history-list card" aria-label="Meeting history results" aria-busy={loading}>
        <div className="history-list-heading">
          <div>
            <h3>{hasFilters ? "Matching meetings" : "Recent meetings"}</h3>
            <p className="muted small">
              {loading ? "Updating your archive…" : `${data.total} ${data.total === 1 ? "meeting" : "meetings"} found`}
            </p>
          </div>
          {hasFilters && <button className="history-clear" onClick={clearFilters}>Clear filters</button>}
        </div>

        {loading ? (
          <div className="history-empty">
            <span className="history-loading-mark" aria-hidden="true" />
            <p>Loading your meetings…</p>
          </div>
        ) : err ? (
          <div className="history-empty">
            <span className="history-empty-icon" aria-hidden="true">!</span>
            <h4>Couldn’t load your meetings</h4>
            <p className="muted">Check your connection and try again.</p>
          </div>
        ) : data.meetings.length === 0 ? (
          <div className="history-empty">
            <span className="history-empty-icon" aria-hidden="true">{hasFilters ? "⌕" : "◷"}</span>
            <h4>{hasFilters ? "No meetings match these filters" : "Your history starts here"}</h4>
            <p className="muted">
              {hasFilters ? "Try another search or clear your filters." : "Meetings you join will appear here for easy access."}
            </p>
            {hasFilters && <button className="ghost" onClick={clearFilters}>Clear filters</button>}
          </div>
        ) : (
          <div className="history-rows">
            {data.meetings.map((meeting) => (
              <article className="history-item" key={meeting._id}>
                <span className="history-item-icon" aria-hidden="true">◷</span>
                <div className="history-item-info">
                  <h4>{meeting.title}</h4>
                  <span className="history-item-date">
                    {new Date(meeting.createdAt).toLocaleString()}
                  </span>
                  {meeting.aiStatus === "done" && (
                    <span className="history-ai-badge"><span aria-hidden="true">✦</span> Summary ready</span>
                  )}
                </div>
                <span className={`pill ${meeting.status}`}>{meeting.status}</span>
                <button className="history-details" onClick={() => openDetails(meeting._id)}>
                  View details <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <nav className="history-pagination" aria-label="Meeting history pages">
        <span className="muted small">
          Showing {data.total === 0 ? 0 : (page - 1) * PER + 1}–{Math.min(page * PER, data.total)} of {data.total}
        </span>
        <div>
          <button className="ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            <span aria-hidden="true">←</span> Previous
          </button>
          <button className="ghost" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>
            Next <span aria-hidden="true">→</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
