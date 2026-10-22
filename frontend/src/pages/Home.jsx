import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Home({ session, openRoom }) {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [joinId, setJoinId] = useState("");
  const [info, setInfo] = useState({}); // meetingId -> summary data
  const [msg, setMsg] = useState("");

  const run = (fn) => async (...a) => {
    setMsg("");
    try { await fn(...a); } catch (e) { setMsg(e.message); }
  };

  const load = run(async () => setMeetings((await api("/meetings?limit=50")).meetings));
  useEffect(() => { load(); }, []);

  const create = run(async (e) => {
    e.preventDefault();
    const d = await api("/meetings", { method: "POST", body: { title } });
    setTitle("");
    openRoom(d.meeting._id);
  });

  const join = run(async (e) => {
    e.preventDefault();
    const id = joinId.trim();
    await api(`/meetings/${id}/join`, { method: "POST" });
    openRoom(id);
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
        <div className="home-meeting-count"><b>{meetings.length}</b><span>recent meetings</span></div>
      </header>

      <section className="home-actions" aria-label="Start or join a meeting">
        <form className="home-action-card home-start" onSubmit={create}>
          <span className="home-action-icon" aria-hidden="true">＋</span>
          <div className="home-action-copy">
            <h3>Start a meeting</h3>
            <p>Start a new conversation with your team.</p>
          </div>
          <div className="home-action-form">
            <input aria-label="New meeting title" placeholder="Give your meeting a name" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
            <button className="primary">Start meeting <span aria-hidden="true">→</span></button>
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
      {msg && <div className="err">{msg}</div>}

      <div className="home-section-heading">
        <div><span className="page-eyebrow">STAY IN THE LOOP</span><h3>Your meetings</h3></div>
        <span className="muted small">{meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}</span>
      </div>
      <div className="grid home-meetings">
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
              <div className="home-meeting-buttons">
                {m.status !== "ended" && <button className="primary" onClick={() => openRoom(m._id)}>Open room</button>}
                {m.host === session.user.id && <button className="ghost" onClick={() => summarize(m._id)}>AI summary</button>}
              </div>
              {d && (
                <div className="summary">
                  <p>{d.aiStatus === "failed" ? "Summary failed. Check the transcript." : d.summary}</p>
                  {d.actionItems.map((a, i) => <div key={i} className="small">• {a.task}</div>)}
                  {d.actionItems.length > 0 && <button className="ghost" onClick={() => makeTasks(m._id)}>Make tasks</button>}
                </div>
              )}
            </article>
          );
        })}
        {meetings.length === 0 && <div className="home-empty card"><span aria-hidden="true">◷</span><h4>No meetings yet</h4><p className="muted">Start a new meeting above and your recent conversations will show up here.</p></div>}
      </div>
    </div>
  );
}
