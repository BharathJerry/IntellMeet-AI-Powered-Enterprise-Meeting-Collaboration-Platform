import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Invite({ code, onBack, openRoom }) {
  const [meeting, setMeeting] = useState(null);
  const [err, setErr] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/meetings/invite/${encodeURIComponent(code)}`)
      .then((data) => { if (active) setMeeting(data.meeting); })
      .catch((error) => { if (active) setErr(error.message); });
    return () => { active = false; };
  }, [code]);

  const join = async () => {
    setJoining(true);
    setErr("");
    try {
      const { meetingId } = await api(`/meetings/invite/${encodeURIComponent(code)}/join`, { method: "POST" });
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url);
      openRoom(meetingId);
    } catch (error) {
      setErr(error.message);
      setJoining(false);
    }
  };

  return (
    <div className="invite-page">
      <button className="lobby-back invite-back" onClick={onBack}><span aria-hidden="true">←</span> Back to meetings</button>
      <section className="invite-card card" aria-labelledby="invite-title">
        <div className="invite-brand" aria-hidden="true"><span>IM</span></div>
        <div className="invite-content">
          <span className="page-eyebrow">MEETING INVITATION</span>
        {err ? (
          <div className="invite-state invite-error-state">
            <span className="invite-state-icon" aria-hidden="true">!</span>
            <h2 id="invite-title">This invitation isn’t available</h2>
            <p className="err" role="alert">{err}</p>
            <button className="ghost" onClick={onBack}>Return to meetings <span aria-hidden="true">→</span></button>
          </div>
        ) : !meeting ? (
          <div className="invite-state" role="status">
            <span className="history-loading-mark" aria-hidden="true" />
            <h2 id="invite-title">Checking your invitation</h2>
            <p className="muted">Confirming the meeting details…</p>
          </div>
        ) : (
          <div className="invite-state">
            <h2 id="invite-title">{meeting.title}</h2>
            <p className="invite-description">You’ve been invited to join this meeting.</p>
            <div className="invite-meta">
              <div className="invite-host">
                <span className="invite-meta-icon" aria-hidden="true">{meeting.host?.[0]?.toUpperCase() || "H"}</span>
                <span><small>Hosted by</small><b>{meeting.host}</b></span>
              </div>
              <span className={`pill ${meeting.status}`}><span className="invite-status-dot" aria-hidden="true" />{meeting.status}</span>
              {meeting.scheduledAt && (
                <div className="invite-schedule">
                  <span className="invite-meta-icon" aria-hidden="true">◷</span>
                  <span><small>Scheduled for</small><b>{new Date(meeting.scheduledAt).toLocaleString()}</b></span>
                </div>
              )}
            </div>
            <div className="invite-actions">
              <button className="primary" onClick={join} disabled={joining}>
                {joining ? "Joining…" : "Join meeting"} <span aria-hidden="true">→</span>
              </button>
              <button className="ghost" onClick={onBack}>Not now</button>
            </div>
            <p className="invite-footnote"><span aria-hidden="true">◈</span> Your camera and microphone stay under your control.</p>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
