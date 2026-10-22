import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Team({ session }) {
  const [wss, setWss] = useState([]);
  const [ws, setWs] = useState("");
  const [w, setW] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/workspaces").then((d) => { setWss(d.workspaces); if (d.workspaces[0]) setWs(d.workspaces[0]._id); }).catch((e) => setErr(e.message));
  }, []);

  const load = () => ws && api(`/workspaces/${ws}`).then((d) => setW(d.workspace)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [ws]);

  const mine = w?.members.find((m) => m.user._id === session.user.id);
  const admin = mine?.role === "admin";

  const invite = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await api(`/workspaces/${ws}/members`, { method: "POST", body: { email, role } });
      setMsg(`${email} was added`);
      setEmail("");
      load();
    } catch (e2) { setErr(e2.message); }
  };

  const remove = async (uid) => {
    setErr("");
    try {
      await api(`/workspaces/${ws}/members/${uid}`, { method: "DELETE" });
      uid === session.user.id ? location.reload() : load();
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <div>
      <h2>Team</h2>
      <div className="row">
        <select aria-label="Workspace" value={ws} onChange={(e) => setWs(e.target.value)}>
          {wss.length === 0 && <option value="">No workspace yet. Create one on the Boards page.</option>}
          {wss.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
        </select>
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      {w && (
        <>
          {admin && (
            <form className="card row" onSubmit={invite}>
              <input type="email" aria-label="Teammate email" placeholder="Teammate's email (they must have signed up)" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button className="primary">Add to workspace</button>
            </form>
          )}
          <div className="card">
            {w.members.map((m) => (
              <div className="hrow" key={m.user._id}>
                <div><b>{m.user.name}</b> {m.user._id === session.user.id && "(you)"}<div className="muted small">{m.user.email}</div></div>
                <span className={`pill ${m.role === "admin" ? "live" : ""}`}>{m.role}{w.owner === m.user._id ? " · owner" : ""}</span>
                {w.owner !== m.user._id && (admin || m.user._id === session.user.id) && (
                  <button className="ghost" onClick={() => remove(m.user._id)}>{m.user._id === session.user.id ? "Leave" : "Remove"}</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
