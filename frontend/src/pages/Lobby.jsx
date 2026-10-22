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
    <div className="card lobby">
      <h2>{title || "Meeting"}</h2>
      <p className="muted small">Check how you look and sound before joining.</p>
      <div className="tile big">
        <video ref={video} autoPlay playsInline muted />
        {(!cam || !stream) && <div className="ph">📷</div>}
      </div>
      <div className="bar">
        <button className={`ctl ${mic ? "" : "off"}`} onClick={() => flip("mic", !mic)}>{mic ? "🎤 Mic on" : "🔇 Mic off"}</button>
        <button className={`ctl ${cam ? "" : "off"}`} onClick={() => flip("cam", !cam)}>{cam ? "📷 Camera on" : "📷 Camera off"}</button>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="row">
        <button className="primary" onClick={() => onJoin({ mic, cam })}>Join now</button>
        <button className="ghost" onClick={onBack}>Cancel</button>
      </div>
    </div>
  );
}
