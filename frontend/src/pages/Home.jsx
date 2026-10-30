import { useEffect, useState } from "react";
import { api } from "../api.js";

const toLocalDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (!value) date.setMinutes(date.getMinutes() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function Home({ session, openRoom }) {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [joinId, setJoinId] = useState("");
  const [info, setInfo] = useState({}); // meetingId -> summary data
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [editTime, setEditTime] = useState("");

  const run = (fn) => async (...a) => {
    setMsg("");
    setErr("");
    try { await fn(...a); } catch (e) { setErr(e.message); }
  };

  const load = async () => {
    setLoading(true);
    try {
      setMeetings((await api("/meetings?limit=50")).meetings);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load().catch((error) => setErr(error.message)); }, []);

  const create = run(async (e) => {
    e.preventDefault();
    const body = { title };
    if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString();
    const d = await api("/meetings", { method: "POST", body });
    setTitle("");
    setScheduledAt("");
    if (scheduledAt) {
      await load();
      setMsg("Meeting scheduled.");
    } else openRoom(d.meeting._id);
  });

  const join = run(async (e) => {
    e.preventDefault();
    const id = joinId.trim();
    await api(`/meetings/${id}/join`, { method: "POST" });
    openRoom(id);
  });

  const share = run(async (id) => {
    const { code } = await api(`/meetings/${id}/invite`, { method: "POST" });
    const link = new URL(window.location.href);
    link.search = "";
    link.hash = "";
    link.searchParams.set("invite", code);
    await navigator.clipboard.writeText(link.toString());
    setMsg("Invitation link copied to clipboard.");
  });

  const reschedule = run(async (e, id) => {
    e.preventDefault();
    await api(`/meetings/${id}`, {
      method: "PATCH",
      body: { scheduledAt: new Date(editTime).toISOString() },
    });
    setEditingId("");
    setEditTime("");
    await load();
    setMsg("Meeting rescheduled.");
  });

  // Starts the AI job, then checks every second until it finishes
  const summarize = run(async (id) => {
    await api(`/meetings/${id}/summarize`, { method: "POST" });
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const d = await api(`/meetings/${id}/summary`);
      if (d.aiStatus !== "pending") return setInfo((x) => ({ ...x, [id]: d }));
    }
  });

  const makeTasks = run(async (id) => {
    const d = await api(`/meetings/${id}/action-items/convert`, { method: "POST" });
    setMsg(`${d.tasks.length} task(s) created`);
  });

  return (
    <div className="home-page">
      <header className="home-heading">
        <div>
          <span className="page-eyebrow">YOUR WORKSPACE</span>
          <h2>Hello, {session.user.name.split(" ")[0]} 👋</h2>
          <p className="muted">Bring your team together and keep great work moving.</p>
        </div>
        <div className="home-meeting-count"><b>{loading ? "—" : meetings.length}</b><span>recent meetings</span></div>
      </header>

      <section className="home-actions" aria-label="Schedule, start, or join a meeting">
        <form className="home-action-card home-start" onSubmit={create}>
          <span className="home-action-icon" aria-hidden="true">＋</span>
          <div className="home-action-copy">
            <h3>{scheduledAt ? "Schedule a meeting" : "Start a meeting"}</h3>
            <p>Start now or choose a date and time for later.</p>
          </div>
          <div className="home-action-form">
            <input aria-label="New meeting title" placeholder="Give your meeting a name" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
            <input aria-label="Meeting date and time (optional)" type="datetime-local" min={toLocalDateTime()} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            <button className="primary">{scheduledAt ? "Schedule meeting" : "Start meeting"} <span aria-hidden="true">→</span></button>
          </div>
        </form>
        <form className="home-action-card home-join" onSubmit={join}>
          <span className="home-action-icon" aria-hidden="true">↗</span>
          <div className="home-action-copy">
            <h3>Join a meeting</h3>
            <p>Have an invite? Enter its meeting ID.</p>
          </div>
          <div className="home-action-form">
            <input aria-label="Join with meeting ID" placeholder="Paste meeting ID" value={joinId} onChange={(e) => setJoinId(e.target.value)} required />
            <button className="ghost">Join room <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
      {err && <div className="err" role="alert">{err}</div>}
      {msg && <div className="home-feedback" role="status">{msg}</div>}

      <div className="home-section-heading">
        <div><span className="page-eyebrow">STAY IN THE LOOP</span><h3>Your meetings</h3></div>
        <span className="muted small">{meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}</span>
      </div>
      <div className="grid home-meetings" aria-busy={loading}>
        {meetings.map((m) => {
          const d = info[m._id];
          return (
            <article className="card home-meeting-card" key={m._id}>
              <div className="home-meeting-card-top">
                <span className="home-meeting-icon" aria-hidden="true">◷</span>
                <span className={`pill ${m.status}`}>{m.status}</span>
              </div>
              <h4>{m.title}</h4>
              <p className="muted small home-meeting-id">Meeting ID <span>{m._id}</span></p>
              {m.scheduledAt && <p className="home-scheduled-time">Scheduled for {new Date(m.scheduledAt).toLocaleString()}</p>}
              <div className="home-meeting-buttons">
                {m.status !== "ended" && <button className="primary" onClick={() => openRoom(m._id)}>Open room</button>}
                {m.status !== "ended" && <button className="ghost" onClick={() => share(m._id)}>Share invite</button>}
                {m.host === session.user.id && m.status !== "ended" && <button className="ghost" onClick={() => {
                  setEditingId(editingId === m._id ? "" : m._id);
                  setEditTime(toLocalDateTime(m.scheduledAt));
                }}>{editingId === m._id ? "Cancel" : m.scheduledAt ? "Reschedule" : "Set time"}</button>}
                {m.host === session.user.id && <button className="ghost" onClick={() => summarize(m._id)}>AI summary</button>}
              </div>
              {editingId === m._id && (
                <form className="home-reschedule-form" onSubmit={(e) => reschedule(e, m._id)}>
                  <label htmlFor={`reschedule-${m._id}`}>New date and time</label>
                  <input id={`reschedule-${m._id}`} type="datetime-local" min={toLocalDateTime()} value={editTime} onChange={(e) => setEditTime(e.target.value)} required />
                  <button className="primary">Save time</button>
                </form>
              )}
              {d && (
                <div className="summary">
                  <div className="summary-heading"><span className="page-eyebrow">MEETING RECAP</span><b>AI summary</b></div>
                  <p>{d.aiStatus === "failed" ? "Summary failed. Check the transcript." : d.summary}</p>
                  {d.actionItems.length > 0 && (
                    <div className="summary-next-steps">
                      <span className="summary-label">Next steps · {d.actionItems.length}</span>
                      {d.actionItems.map((a, i) => <div key={i} className="small summary-action-item"><span aria-hidden="true">•</span>{a.task}</div>)}
                      <button className="ghost" onClick={() => makeTasks(m._id)}>Create tasks <span aria-hidden="true">→</span></button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {loading && meetings.length === 0 && <div className="home-empty card" role="status"><span className="history-loading-mark" aria-hidden="true" /><p className="muted">Loading your meetings…</p></div>}
        {!loading && !err && meetings.length === 0 && <div className="home-empty card"><span aria-hidden="true">◷</span><h4>No meetings yet</h4><p className="muted">Start a new meeting above and your recent conversations will show up here.</p></div>}
      </div>
    </div>
  );
}
