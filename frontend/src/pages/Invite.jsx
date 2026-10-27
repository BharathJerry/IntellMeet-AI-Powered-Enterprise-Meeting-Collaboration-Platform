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
      <button className="lobby-back" onClick={onBack}><span aria-hidden="true">←</span> Back to meetings</button>
      <section className="invite-card card">
        <span className="page-eyebrow">MEETING INVITATION</span>
        {err ? (
          <>
            <h2>This invitation isn’t available</h2>
            <p className="err" role="alert">{err}</p>
            <button className="ghost" onClick={onBack}>Return to meetings</button>
          </>
        ) : !meeting ? (
          <div className="dashboard-loading"><span className="history-loading-mark" aria-hidden="true" /><p className="muted">Checking your invitation…</p></div>
        ) : (
          <>
            <h2>{meeting.title}</h2>
            <p className="muted">Hosted by {meeting.host}</p>
            {meeting.scheduledAt && <p className="invite-time">Scheduled for {new Date(meeting.scheduledAt).toLocaleString()}</p>}
            <span className={`pill ${meeting.status}`}>{meeting.status}</span>
            <div className="invite-actions">
              <button className="primary" onClick={join} disabled={joining}>
                {joining ? "Joining…" : "Join meeting"} <span aria-hidden="true">→</span>
              </button>
              <button className="ghost" onClick={onBack}>Not now</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
