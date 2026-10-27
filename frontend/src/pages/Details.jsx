import { useEffect, useState } from "react";
import { api } from "../api.js";
import { toast } from "../toast.js";
import Recordings from "./Recordings.jsx";

export default function Details({ id, session, onBack, openRoom }) {
  const [m, setM] = useState(null);
  const [err, setErr] = useState("");

  const load = () => api(`/meetings/${id}`).then((d) => setM(d.meeting)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);

  if (!m) return <div className="details-page">{err ? <div className="err" role="alert">{err}</div> : <div className="dashboard-loading"><span className="history-loading-mark" aria-hidden="true" /><p className="muted">Loading meeting details…</p></div>}</div>;
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
    <div className="details-page">
      <button className="details-back" onClick={onBack} aria-label="Back to history"><span aria-hidden="true">←</span> Meeting history</button>
      <header className="details-heading">
        <div><span className="page-eyebrow">MEETING NOTES</span><h2>{m.title}</h2><div className="details-date"><span>{new Date(m.createdAt).toLocaleString()}</span><span className={`pill ${m.status}`}>{m.status}</span></div></div>
        <div className="details-actions">
          {m.status !== "ended" && <button className="primary" onClick={() => openRoom(id)}>Join meeting <span aria-hidden="true">→</span></button>}
          {isHost && <button className="ghost" onClick={summarize} disabled={!m.transcript || m.aiStatus === "pending"}>{m.aiStatus === "pending" ? "Summarizing…" : "✦ Generate summary"}</button>}
          <button className="ghost" onClick={exportTxt}><span aria-hidden="true">↓</span> Export notes</button>
        </div>
      </header>
      {err && <div className="err" role="alert">{err}</div>}

      <div className="details-grid">
        <section className="card details-summary">
          <div className="details-section-heading"><span className="details-section-icon" aria-hidden="true">✦</span><div><span className="page-eyebrow">AI RECAP</span><h3>Meeting summary</h3></div></div>
          <p className="details-summary-text">{m.aiStatus === "failed" ? "Summary failed. Check the transcript and try again." : m.summary || <span className="muted">No summary yet. Generate one from the transcript when you’re ready.</span>}</p>
        </section>

        <section className="card details-actions-card">
          <div className="details-section-heading"><span className="details-section-icon details-task-icon" aria-hidden="true">✓</span><div><span className="page-eyebrow">NEXT STEPS</span><h3>Action items <span className="details-item-count">{m.actionItems.length}</span></h3></div></div>
          {m.actionItems.length > 0 ? (
            <div className="details-action-list">
              {m.actionItems.map((a) => <div key={a._id} className="details-action-item"><span className={`details-check ${a.converted ? "is-done" : ""}`} aria-hidden="true">{a.converted ? "✓" : ""}</span><span>{a.task}</span>{a.converted && <span className="pill live">task created</span>}</div>)}
            </div>
          ) : <p className="muted small">No action items were identified for this meeting.</p>}
          {m.actionItems.some((a) => !a.converted) && <button className="primary details-convert-button" onClick={makeTasks}>Create tasks <span aria-hidden="true">→</span></button>}
        </section>

        <section className="card details-transcript-card">
          <div className="details-section-heading"><span className="details-section-icon details-transcript-icon" aria-hidden="true">≡</span><div><span className="page-eyebrow">FULL RECORD</span><h3>Transcript</h3></div></div>
          <pre className="transcript" tabIndex={0}>{m.transcript || "No transcript recorded. Use Transcribe inside the meeting room."}</pre>
        </section>
      </div>

      <Recordings id={id} />
    </div>
  );
}
