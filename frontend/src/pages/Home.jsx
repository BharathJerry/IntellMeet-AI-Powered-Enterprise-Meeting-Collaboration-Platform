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
    <div>
      <h2>Hello, {session.user.name.split(" ")[0]} 👋</h2>
      <div className="row">
        <form className="card row" onSubmit={create}>
          <input placeholder="New meeting title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
          <button className="primary">Start meeting</button>
        </form>
        <form className="card row" onSubmit={join}>
          <input placeholder="Join with meeting ID" value={joinId} onChange={(e) => setJoinId(e.target.value)} required />
          <button className="primary">Join</button>
        </form>
      </div>
      {msg && <div className="err">{msg}</div>}

      <h3>Your meetings</h3>
      <div className="grid">
        {meetings.map((m) => {
          const d = info[m._id];
          return (
            <div className="card" key={m._id}>
              <span className={`pill ${m.status}`}>{m.status}</span>
              <h4>{m.title}</h4>
              <p className="muted small">ID: {m._id}</p>
              <div className="row">
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
            </div>
          );
        })}
        {meetings.length === 0 && <p className="muted">No meetings yet. Start one above.</p>}
      </div>
    </div>
  );
}
