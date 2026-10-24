import { useEffect, useState } from "react";
import { api } from "../api.js";

// Saved recordings of a meeting: load one into a player, or download it
export default function Recordings({ id }) {
  const [list, setList] = useState([]);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api(`/meetings/${id}/recordings`).then((d) => setList(d.recordings)).catch((e) => setErr(e.message));
  }, [id]);

  const load = async (r) => {
    setErr("");
    try {
      setUrl(URL.createObjectURL(await api(`/meetings/${id}/recordings/${r.id}`, { as: "blob" })));
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card recs" style={{ marginTop: 14 }}>
      <h4>Recordings</h4>
      {err && <div className="err">{err}</div>}
      {list.length === 0 && <p className="muted small">No recordings yet. Use Record inside the meeting room.</p>}
      {list.map((r) => (
        <div className="hrow" key={r.id}>
          <div>{new Date(r.createdAt).toLocaleString()}<div className="muted small">by {r.by} · {(r.size / 1048576).toFixed(1)} MB</div></div>
          <button className="ghost" onClick={() => load(r)}>▶ Play</button>
        </div>
      ))}
      {url && (
        <>
          <video src={url} controls />
          <a className="small" href={url} download="meeting-recording.webm">⬇ Download</a>
        </>
      )}
    </div>
  );
}
