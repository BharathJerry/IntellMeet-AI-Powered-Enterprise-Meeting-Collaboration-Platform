import { useEffect, useState } from "react";
import { api } from "../api.js";
import { toast } from "../toast.js";

export default function Details({ id, session, onBack, openRoom }) {
  const [m, setM] = useState(null);
  const [err, setErr] = useState("");

  const load = () => api(`/meetings/${id}`).then((d) => setM(d.meeting)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);

  if (!m) return <p className="muted">{err || "Loading…"}</p>;
  const isHost = m.host === session.user.id;

  const summarize = async () => {
    try {
      await api(`/meetings/${id}/summarize`, { method: "POST" });
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const d = await api(`/meetings/${id}/summary`);
        if (d.aiStatus !== "pending") return load();
      }
    } catch (e) { setErr(e.message); }
  };

  const makeTasks = async () => {
    try {
      const d = await api(`/meetings/${id}/action-items/convert`, { method: "POST" });
      toast(`${d.tasks.length} task(s) created`);
      load();
    } catch (e) { setErr(e.message); }
  };

  // Download a plain-text report: summary, action items and the full transcript
  const exportTxt = () => {
    const text = [
      m.title, new Date(m.createdAt).toLocaleString(), "", "SUMMARY", m.summary || "(none)", "",
      "ACTION ITEMS", ...m.actionItems.map((a) => `- ${a.task}${a.converted ? " (task created)" : ""}`), "",
      "TRANSCRIPT", m.transcript || "(none)",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${m.title.replace(/\W+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="row">
        <button className="ghost" onClick={onBack} aria-label="Back to history">‹</button>
        <h2>{m.title}</h2>
        <span className={`pill ${m.status}`}>{m.status}</span>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="row">
        {m.status !== "ended" && <button className="primary" onClick={() => openRoom(id)}>Join meeting</button>}
        {isHost && <button className="ghost" onClick={summarize} disabled={!m.transcript || m.aiStatus === "pending"}>{m.aiStatus === "pending" ? "Summarizing…" : "🧠 AI summary"}</button>}
        <button className="ghost" onClick={exportTxt}>⬇ Export .txt</button>
      </div>

      <div className="card">
        <h4>Summary</h4>
        <p>{m.aiStatus === "failed" ? "Summary failed. Check the transcript and try again." : m.summary || <span className="muted">No summary yet.</span>}</p>
        <h4>Action items</h4>
        {m.actionItems.map((a) => <div key={a._id} className="small">• {a.task} {a.converted && <span className="pill live">task</span>}</div>)}
        {m.actionItems.length === 0 && <p className="muted small">None yet.</p>}
        {m.actionItems.some((a) => !a.converted) && <button className="ghost" onClick={makeTasks}>Make tasks</button>}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h4>Transcript</h4>
        <pre className="transcript" tabIndex={0}>{m.transcript || "No transcript recorded. Use Transcribe inside the meeting room."}</pre>
      </div>
    </div>
  );
}
