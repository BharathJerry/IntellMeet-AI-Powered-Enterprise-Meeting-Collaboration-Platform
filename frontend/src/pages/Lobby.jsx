import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

// Pre-join screen: check your camera and mic, then enter the meeting
export default function Lobby({ meetingId, onJoin, onBack }) {
  const [title, setTitle] = useState("");
  const [stream, setStream] = useState(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [err, setErr] = useState("");
  const video = useRef();
  const held = useRef();

  useEffect(() => {
    api(`/meetings/${meetingId}`).then((d) => setTitle(d.meeting.title)).catch((e) => setErr(e.message));
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((s) => { held.current = s; setStream(s); })
      .catch(() => setErr("Camera or microphone unavailable. You can still join and chat."));
    return () => held.current?.getTracks().forEach((t) => t.stop());
  }, [meetingId]);

  useEffect(() => { if (video.current) video.current.srcObject = stream; }, [stream]);

  const flip = (kind, on) => {
    const tracks = kind === "mic" ? stream?.getAudioTracks() : stream?.getVideoTracks();
    tracks?.forEach((t) => (t.enabled = on));
    kind === "mic" ? setMic(on) : setCam(on);
  };

  return (
    <div className="lobby-page">
      <button className="lobby-back" onClick={onBack}><span aria-hidden="true">←</span> Back to meetings</button>
      <section className="lobby-card card">
        <div className="lobby-heading"><span className="page-eyebrow">READY TO JOIN?</span><h2>{title || "Meeting"}</h2><p className="muted">Take a moment to check your camera and microphone.</p></div>
        <div className="lobby-preview">
          <div className="tile big">
            <video ref={video} autoPlay playsInline muted />
            {(!cam || !stream) && <div className="ph"><span aria-hidden="true">◉</span><small>{cam ? "Waiting for camera…" : "Your camera is off"}</small></div>}
            <span className="lobby-preview-label"><span className="lobby-preview-dot" /> Preview · only you can see this</span>
          </div>
        </div>
        <div className="lobby-device-row">
          <button className={`ctl lobby-device ${mic ? "" : "off"}`} onClick={() => flip("mic", !mic)}><span className="lobby-device-icon" aria-hidden="true">{mic ? "♩" : "×"}</span><span><b>Microphone</b><small>{mic ? "On" : "Off"}</small></span><span className="lobby-device-state" /></button>
          <button className={`ctl lobby-device ${cam ? "" : "off"}`} onClick={() => flip("cam", !cam)}><span className="lobby-device-icon" aria-hidden="true">{cam ? "▣" : "×"}</span><span><b>Camera</b><small>{cam ? "On" : "Off"}</small></span><span className="lobby-device-state" /></button>
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="lobby-actions">
          <button className="primary" onClick={() => onJoin({ mic, cam })}>Join meeting <span aria-hidden="true">→</span></button>
          <button className="ghost" onClick={onBack}>Cancel</button>
        </div>
      </section>
      <p className="lobby-privacy"><span aria-hidden="true">◈</span> Your camera and microphone settings stay under your control.</p>
    </div>
  );
}
