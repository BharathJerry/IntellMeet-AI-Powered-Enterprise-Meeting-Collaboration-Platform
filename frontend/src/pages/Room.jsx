import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, API, getSession } from "../api.js";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function Tile({ stream, name, muted, off, local, big }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.srcObject = stream || null; }, [stream]);
  return (
    <div className={big ? "tile big" : "tile"}>
      <video ref={ref} autoPlay playsInline muted={!!local} />
      {(off || !stream) && <div className="ph">{name?.[0] || "?"}</div>}
      <span className="tag">{name}{muted ? " 🔇" : ""}</span>
    </div>
  );
}

export default function Room({ meetingId, session, onLeave, initial = {} }) {
  const me = session.user;
  const [title, setTitle] = useState("Meeting");
  const [peers, setPeers] = useState({}); // socketId -> { name, stream, muted, videoOff }
  const [local, setLocal] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState("");
  const [mic, setMic] = useState(initial.mic !== false);
  const [cam, setCam] = useState(initial.cam !== false);
  const [rec, setRec] = useState(false);
  const [err, setErr] = useState("");
  const sock = useRef(null), media = useRef(null), pcs = useRef({}), queue = useRef(Promise.resolve());
  const typingTimer = useRef(), speech = useRef(), endRef = useRef();

  useEffect(() => {
    let dead = false;
    api(`/meetings/${meetingId}`).then((d) => setTitle(d.meeting.title)).catch(() => {});

    (async () => {
      try {
        media.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setErr("Camera or microphone unavailable. You can still chat and see others.");
        media.current = new MediaStream();
      }
      if (dead) return media.current.getTracks().forEach((t) => t.stop());
      if (initial.mic === false) media.current.getAudioTracks().forEach((t) => (t.enabled = false));
      if (initial.cam === false) media.current.getVideoTracks().forEach((t) => (t.enabled = false));
      setLocal(media.current);

      const s = (sock.current = io(API, { auth: { token: getSession().accessToken } }));

      // One RTCPeerConnection per other person (mesh: fine for small meetings)
      const makePc = (id) => {
        const pc = new RTCPeerConnection(ICE);
        media.current.getTracks().forEach((t) => pc.addTrack(t, media.current));
        pc.onicecandidate = (e) => e.candidate && s.emit("signal", { to: id, data: { candidate: e.candidate } });
        pc.ontrack = (e) => setPeers((x) => ({ ...x, [id]: { ...x[id], stream: e.streams[0] } }));
        return (pcs.current[id] = pc);
      };

      const onSignal = async (from, data) => {
        const pc = pcs.current[from] || makePc(from);
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          if (data.sdp.type === "offer") {
            await pc.setLocalDescription(await pc.createAnswer());
            s.emit("signal", { to: from, data: { sdp: pc.localDescription } });
          }
        } else if (data.candidate) {
          await pc.addIceCandidate(data.candidate);
        }
      };

      // handle signals one at a time so ICE candidates never overtake the offer
      s.on("signal", ({ from, data }) => { queue.current = queue.current.then(() => onSignal(from, data)).catch(() => {}); });
      s.on("participant:joined", (p) => setPeers((x) => ({ ...x, [p.socketId]: { ...x[p.socketId], name: p.name, muted: p.muted, videoOff: p.videoOff } })));
      s.on("participant:left", ({ socketId }) => {
        pcs.current[socketId]?.close();
        delete pcs.current[socketId];
        setPeers((x) => { const n = { ...x }; delete n[socketId]; return n; });
      });
      s.on("media:state", (m) => setPeers((x) => (x[m.socketId] ? { ...x, [m.socketId]: { ...x[m.socketId], muted: m.muted, videoOff: m.videoOff } } : x)));
      s.on("chat:message", (m) => setMsgs((x) => [...x, m]));
      s.on("chat:typing", (t) => setTyping(t.isTyping ? `${t.name} is typing…` : ""));
      s.on("connect_error", (e) => setErr(e.message));

      s.emit("meeting:join", { meetingId }, async (res) => {
        if (!res.ok) return setErr(res.error);
        setMsgs(res.messages);
        if (initial.mic === false || initial.cam === false) s.emit("media:state", { muted: initial.mic === false, videoOff: initial.cam === false });
        setPeers(Object.fromEntries(res.participants.map((p) => [p.socketId, p])));
        // the newcomer calls everyone already in the room
        for (const p of res.participants) {
          const pc = makePc(p.socketId);
          await pc.setLocalDescription(await pc.createOffer());
          s.emit("signal", { to: p.socketId, data: { sdp: pc.localDescription } });
        }
      });
    })();

    return () => {
      dead = true;
      sock.current?.disconnect();
      Object.values(pcs.current).forEach((pc) => pc.close());
      media.current?.getTracks().forEach((t) => t.stop());
      speech.current?.stop();
    };
  }, [meetingId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const toggle = (kind) => {
    const track = (kind === "audio" ? media.current.getAudioTracks() : media.current.getVideoTracks())[0];
    if (!track) return;
    track.enabled = !track.enabled;
    kind === "audio" ? setMic(track.enabled) : setCam(track.enabled);
    const a = media.current.getAudioTracks()[0], v = media.current.getVideoTracks()[0];
    sock.current.emit("media:state", { muted: a ? !a.enabled : true, videoOff: v ? !v.enabled : true });
  };

  const share = async () => {
    try {
      const screen = (await navigator.mediaDevices.getDisplayMedia({ video: true })).getVideoTracks()[0];
      const swap = (t) => Object.values(pcs.current).forEach((pc) => pc.getSenders().find((x) => x.track?.kind === "video")?.replaceTrack(t));
      swap(screen);
      screen.onended = () => swap(media.current.getVideoTracks()[0] || null);
    } catch { /* user cancelled */ }
  };

  // Free live transcription with the browser's speech recognition (Chrome/Edge); feeds the AI summary
  const transcribe = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return setErr("Speech recognition needs Chrome or Edge.");
    if (speech.current) {
      const r = speech.current;
      speech.current = null;
      r.stop();
      return setRec(false);
    }
    const r = new SR();
    r.continuous = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const line = last[0].transcript.trim();
      if (last.isFinal && line) api(`/meetings/${meetingId}/transcript`, { method: "POST", body: { text: line } }).catch(() => {});
    };
    r.onend = () => { if (speech.current) r.start(); };
    r.start();
    speech.current = r;
    setRec(true);
  };

  const onType = (v) => {
    setText(v);
    sock.current.emit("chat:typing", { isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => sock.current.emit("chat:typing", { isTyping: false }), 1500);
  };

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sock.current.emit("chat:message", { text }, (r) => !r.ok && setErr(r.error));
    sock.current.emit("chat:typing", { isTyping: false });
    setText("");
  };

  const others = Object.entries(peers).map(([id, p]) => ({ id, ...p }));
  const mine = { stream: local, name: `${me.name} (You)`, muted: !mic, off: !cam, local: true };
  const stage = others[0] ? { stream: others[0].stream, name: others[0].name || "Guest", muted: others[0].muted, off: others[0].videoOff } : mine;
  const thumbs = others[0] ? [mine, ...others.slice(1).map((p) => ({ stream: p.stream, name: p.name || "Guest", muted: p.muted, off: p.videoOff }))] : [];

  return (
    <div className="room">
      <section className="card stage">
        <header>
          <button className="ghost" onClick={onLeave}>‹</button>
          <div><h2>{title}</h2><span className="muted small">Attendees: <b>{others.length + 1}</b></span></div>
          {rec && <span className="rec">● Transcribing</span>}
        </header>
        {err && <div className="err">{err}</div>}
        <Tile big {...stage} />
        <div className="thumbs">{thumbs.map((t, i) => <Tile key={i} {...t} />)}</div>
        <footer className="bar">
          <button className="leave" onClick={onLeave}>Leave</button>
          <button className={`ctl ${mic ? "" : "off"}`} onClick={() => toggle("audio")}>{mic ? "🎤 Mute" : "🔇 Unmute"}</button>
          <button className={`ctl ${cam ? "" : "off"}`} onClick={() => toggle("video")}>{cam ? "📷 Camera off" : "📷 Camera on"}</button>
          <button className="ctl" onClick={share}>🖥 Share screen</button>
          <button className="ctl" onClick={transcribe}>{rec ? "⏹ Stop transcript" : "📝 Transcribe"}</button>
        </footer>
      </section>

      <aside className="card side">
        <h3>Participants <span className="count">({others.length + 1})</span></h3>
        <div className="plist">
          <div>{me.name} (You) {mic ? "" : "🔇"}</div>
          {others.map((p) => <div key={p.id}>{p.name || "Guest"} {p.muted ? "🔇" : ""}</div>)}
        </div>
        <h3>Chat <span className="count">({msgs.length})</span></h3>
        <div className="chat">
          {msgs.map((m) => (
            <div key={m.id} className={m.senderId === me.id ? "msg mine" : "msg"}>
              <small>{m.senderId === me.id ? "You" : m.senderName}</small>
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="small muted">{typing}</div>
        <form className="send" onSubmit={send}>
          <input aria-label="Type your message" placeholder="Type your message" value={text} onChange={(e) => onType(e.target.value)} />
          <button>➤</button>
        </form>
      </aside>
    </div>
  );
}
