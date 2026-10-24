import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, API, getSession } from "../api.js";
import "../present.css";
import { toast } from "../toast.js";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function Tile({ stream, name, muted, off, local, big, screen }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.srcObject = stream || null; }, [stream]);
  return (
    <div className={`tile room-video-tile${big ? " big" : ""}${screen ? " screen" : ""}`}>
      <video ref={ref} autoPlay playsInline muted={!!local} />
      {(off || !stream) && <div className="ph"><span className="room-avatar-initial">{name?.[0] || "?"}</span></div>}
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
  const [shareStream, setShareStream] = useState(null);
  const shareRef = useRef(null), screenApi = useRef({});
  const [recording, setRecording] = useState(false);
  const [recorders, setRecorders] = useState({}); // userId -> name, for other people recording
  const recorder = useRef(null);

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
        if (data.screen) return onScreenSignal(from, data);
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

      // ---- Presenting a screen, like Google Meet ----
      // A second connection per viewer carries the screen, so cameras keep working untouched.
      const out = {}; // screens I send, by viewer socket id
      const inn = {}; // screens others send me, by presenter socket id
      const sendScreenTo = async (id) => {
        if (out[id]) return;
        const pc = (out[id] = new RTCPeerConnection(ICE));
        shareRef.current.getTracks().forEach((t) => pc.addTrack(t, shareRef.current));
        pc.onicecandidate = (e) => e.candidate && s.emit("signal", { to: id, data: { screen: "p", candidate: e.candidate } });
        await pc.setLocalDescription(await pc.createOffer());
        s.emit("signal", { to: id, data: { screen: "p", sdp: pc.localDescription } });
      };
      const onScreenSignal = async (from, data) => {
        if (data.screen === "stop") { // the presenter stopped
          inn[from]?.close();
          delete inn[from];
          return setPeers((x) => (x[from] ? { ...x, [from]: { ...x[from], screen: null } } : x));
        }
        if (data.screen === "v") { // a viewer answering my screen
          const pc = out[from];
          if (data.sdp) await pc?.setRemoteDescription(data.sdp);
          else if (data.candidate) await pc?.addIceCandidate(data.candidate);
          return;
        }
        let pc = inn[from]; // "p": someone is presenting to me
        if (!pc) {
          pc = inn[from] = new RTCPeerConnection(ICE);
          pc.onicecandidate = (e) => e.candidate && s.emit("signal", { to: from, data: { screen: "v", candidate: e.candidate } });
          pc.ontrack = (e) => setPeers((x) => ({ ...x, [from]: { ...x[from], screen: e.streams[0] } }));
        }
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          s.emit("signal", { to: from, data: { screen: "v", sdp: pc.localDescription } });
        } else if (data.candidate) await pc.addIceCandidate(data.candidate);
      };
      screenApi.current = {
        start: async () => {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); // audio = shared tab sound
          shareRef.current = stream;
          setShareStream(stream);
          stream.getVideoTracks()[0].onended = () => screenApi.current.stop(); // the browser's own "Stop sharing" bar
          for (const id of Object.keys(pcs.current)) await sendScreenTo(id);
        },
        stop: () => {
          if (!shareRef.current) return;
          shareRef.current.getTracks().forEach((t) => t.stop());
          shareRef.current = null;
          setShareStream(null);
          Object.entries(out).forEach(([id, pc]) => {
            pc.close();
            delete out[id];
            s.emit("signal", { to: id, data: { screen: "stop" } });
          });
        },
        closeAll: () => {
          Object.values(out).forEach((pc) => pc.close());
          Object.values(inn).forEach((pc) => pc.close());
        },
      };

      // handle signals one at a time so ICE candidates never overtake the offer
      s.on("signal", ({ from, data }) => { queue.current = queue.current.then(() => onSignal(from, data)).catch(() => {}); });
      s.on("participant:joined", (p) => {
        setPeers((x) => ({ ...x, [p.socketId]: { ...x[p.socketId], name: p.name, muted: p.muted, videoOff: p.videoOff } }));
        if (shareRef.current) sendScreenTo(p.socketId).catch(() => {});
      });
      s.on("participant:left", ({ socketId }) => {
        pcs.current[socketId]?.close();
        delete pcs.current[socketId];
        out[socketId]?.close();
        delete out[socketId];
        inn[socketId]?.close();
        delete inn[socketId];
        setPeers((x) => { const n = { ...x }; delete n[socketId]; return n; });
      });
      s.on("media:state", (m) => setPeers((x) => (x[m.socketId] ? { ...x, [m.socketId]: { ...x[m.socketId], muted: m.muted, videoOff: m.videoOff } } : x)));
      s.on("chat:message", (m) => setMsgs((x) => [...x, m]));
      s.on("chat:typing", (t) => setTyping(t.isTyping ? `${t.name} is typing…` : ""));
      s.on("recording:state", (r) => {
        setRecorders((x) => { const n = { ...x }; r.recording ? (n[r.userId] = r.name) : delete n[r.userId]; return n; });
        toast(r.recording ? `🔴 ${r.name} started recording` : `${r.name} stopped recording`);
      });
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
      if (recorder.current?.state === "recording") recorder.current.stop();
      screenApi.current.closeAll?.();
      shareRef.current?.getTracks().forEach((t) => t.stop());
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

  const present = () =>
    shareRef.current ? screenApi.current.stop() : screenApi.current.start().catch(() => {}); // cancelling the picker is fine

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

  // Records this tab (everyone's video and voices) plus your own microphone, then saves it to the meeting
  const toggleRecord = async () => {
    if (recorder.current) return recorder.current.stop();
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true });
      const ctx = new AudioContext();
      const mix = ctx.createMediaStreamDestination();
      [screen, media.current].forEach((st) => st.getAudioTracks().length && ctx.createMediaStreamSource(new MediaStream(st.getAudioTracks())).connect(mix));
      const stream = new MediaStream([...screen.getVideoTracks(), ...mix.stream.getAudioTracks()]);
      const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: type });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        screen.getTracks().forEach((t) => t.stop());
        ctx.close();
        recorder.current = null;
        setRecording(false);
        sock.current?.emit("recording:state", { recording: false });
        try {
          await api(`/meetings/${meetingId}/recordings`, { method: "POST", body: new Blob(chunks, { type: "video/webm" }) });
          toast("✅ Recording saved. Find it under the meeting's details.");
        } catch (e) { setErr(`Recording not saved: ${e.message}`); }
      };
      screen.getVideoTracks()[0].onended = () => rec.state !== "inactive" && rec.stop(); // browser's own "Stop sharing"
      rec.start(1000);
      recorder.current = rec;
      setRecording(true);
      sock.current.emit("recording:state", { recording: true });
    } catch { /* picker cancelled */ }
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
  const tile = (p) => ({ stream: p.stream, name: p.name || "Guest", muted: p.muted, off: p.videoOff });
  const presenter = others.find((p) => p.screen);
  const slide = presenter
    ? { stream: presenter.screen, name: `${presenter.name || "Guest"} is presenting` }
    : shareStream ? { stream: shareStream, name: "You are presenting", local: true } : null;
  // like Google Meet: the shared screen takes the stage and everyone's camera moves to the strip below
  const stage = slide ? { ...slide, screen: true } : others[0] ? tile(others[0]) : mine;
  const thumbs = slide ? [mine, ...others.map(tile)] : others[0] ? [mine, ...others.slice(1).map(tile)] : [];

  return (
    <div className="room room-page">
      <section className="card stage room-stage">
        <header className="room-stage-header">
          <button className="ghost room-back" onClick={onLeave} aria-label="Back to meetings">‹</button>
          <div className="room-title">
            <span className="page-eyebrow">LIVE MEETING</span>
            <h2>{title}</h2>
            <div className="room-meta">
              <span className="room-participant-count"><span className="room-live-dot" />Attendees: <b>{others.length + 1}</b></span>
            </div>
          </div>
          {rec && <span className="rec"><span className="room-live-dot" />Transcribing</span>}
          {(recording || Object.keys(recorders).length > 0) && (
            <span className="rec"><span className="room-live-dot" />Recording{recording ? "" : ` (${Object.values(recorders).join(", ")})`}</span>
          )}
        </header>
        {err && <div className="err">{err}</div>}
        {shareStream && (
          <div className="presenting" role="status">
            You are presenting your screen
            <button className="leave" onClick={present}>Stop presenting</button>
          </div>
        )}
        <div className="room-stage-surface"><Tile big {...stage} /></div>
        {thumbs.length > 0 ? (
          <div className="thumbs room-thumbnails">{thumbs.map((t, i) => <Tile key={i} {...t} />)}</div>
        ) : (
          <div className="room-attendee-empty">
            <span className="room-attendee-empty-avatar">+</span>
            <span><b>Waiting for others to join</b><small>Your meeting is ready when they are.</small></span>
          </div>
        )}
        <footer className="bar room-controls">
          <button className="leave" onClick={onLeave}>Leave</button>
          <button className={`ctl ${mic ? "" : "off"}`} onClick={() => toggle("audio")}>{mic ? "🎤 Mute" : "🔇 Unmute"}</button>
          <button className={`ctl ${cam ? "" : "off"}`} onClick={() => toggle("video")}>{cam ? "📷 Camera off" : "📷 Camera on"}</button>
          <button className={`ctl ${shareStream ? "off" : ""}`} onClick={present}>{shareStream ? "⏹ Stop presenting" : "🖥 Present screen"}</button>
          <button className="ctl" onClick={transcribe}>{rec ? "⏹ Stop transcript" : "📝 Transcribe"}</button>
          <button className={`ctl ${recording ? "off" : ""}`} onClick={toggleRecord}>{recording ? "⏹ Stop recording" : "⏺ Record"}</button>
        </footer>
      </section>

      <aside className="card side room-sidebar">
        <section className="room-participants">
          <div className="room-sidebar-heading">
            <div><span className="page-eyebrow">IN THIS CALL</span><h3>Participants</h3></div>
            <span className="room-count-badge">{others.length + 1}</span>
          </div>
          <div className="plist room-participant-list">
            <div className="room-participant">
              <span className="room-person-avatar">{me.name[0]}</span>
              <span className="room-person-info"><b>{me.name} (You)</b><small>{mic ? "Microphone on" : "Microphone off"}</small></span>
              <span aria-label={mic ? "Microphone on" : "Microphone muted"}>{mic ? "🎙" : "🔇"}</span>
            </div>
            {others.map((p) => {
              const name = p.name || "Guest";
              return (
                <div className="room-participant" key={p.id}>
                  <span className="room-person-avatar room-person-avatar-alt">{name[0]}</span>
                  <span className="room-person-info"><b>{name}</b><small>{p.muted ? "Microphone off" : "In the meeting"}</small></span>
                  <span aria-label={p.muted ? "Microphone muted" : "Microphone on"}>{p.muted ? "🔇" : "🎙"}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="room-chat-section">
          <div className="room-sidebar-heading">
            <div><span className="page-eyebrow">MESSAGES</span><h3>Chat</h3></div>
            <span className="room-count-badge">{msgs.length}</span>
          </div>
          <div className="chat room-chat" aria-live="polite">
            {msgs.length === 0 && (
              <div className="room-chat-empty">
                <span>✉</span>
                <p>No messages yet. Send a message to start the conversation.</p>
              </div>
            )}
          {msgs.map((m) => (
            <div key={m.id} className={m.senderId === me.id ? "msg mine" : "msg"}>
              <small>{m.senderId === me.id ? "You" : m.senderName}</small>
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>
          <div className="small muted room-typing" role="status">{typing}</div>
          <form className="send room-send" onSubmit={send}>
            <input aria-label="Type your message" placeholder="Type your message" value={text} onChange={(e) => onType(e.target.value)} />
            <button aria-label="Send message" title="Send message">➤</button>
          </form>
        </section>
      </aside>
    </div>
  );
}
