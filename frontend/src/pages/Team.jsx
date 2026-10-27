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
    <div className="team-page">
      <header className="page-heading team-heading">
        <div><span className="page-eyebrow">PEOPLE & PERMISSIONS</span><h2>Your team</h2><p className="muted">{w ? `People collaborating in ${w.name}.` : "Manage the people in your workspace."}</p></div>
        {w && <div className="team-count"><b>{w.members.length}</b><span>{w.members.length === 1 ? "member" : "members"}</span></div>}
      </header>
      <section className="team-workspace-picker">
        <span className="team-picker-icon" aria-hidden="true">▦</span>
        <div className="team-workspace-copy"><span className="page-eyebrow">CURRENT WORKSPACE</span><p className="muted small">Select which team you want to manage.</p></div>
        <select aria-label="Workspace" value={ws} onChange={(e) => setWs(e.target.value)}>
          {wss.length === 0 && <option value="">No workspace yet. Create one on the Boards page.</option>}
          {wss.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
        </select>
      </section>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      {w && (
        <>
          {admin && (
            <form className="team-invite-card card" onSubmit={invite}>
              <div className="team-section-heading"><span className="team-invite-icon" aria-hidden="true">＋</span><div><h3>Invite a teammate</h3><p className="muted small">Add someone who already has an IntellMeet account.</p></div></div>
              <div className="team-invite-fields">
                <input type="email" aria-label="Teammate email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="primary">Add to workspace <span aria-hidden="true">→</span></button>
              </div>
            </form>
          )}
          <section className="team-members-card card">
            <div className="team-list-heading"><div><span className="page-eyebrow">WORKSPACE DIRECTORY</span><h3>Members</h3></div><span className="team-member-count">{w.members.length}</span></div>
            <div className="team-member-list">
              {w.members.map((m) => (
                <div className="team-member-row" key={m.user._id}>
                  <span className="team-member-avatar" aria-hidden="true">{m.user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                  <div className="team-member-info"><b>{m.user.name} {m.user._id === session.user.id && <span className="team-you-label">You</span>}</b><span className="muted small">{m.user.email}</span></div>
                  <span className={`pill ${m.role === "admin" ? "live" : ""}`}>{m.role}{w.owner === m.user._id ? " · owner" : ""}</span>
                  {w.owner !== m.user._id && (admin || m.user._id === session.user.id) && (
                    <button className="ghost team-member-action" onClick={() => remove(m.user._id)}>{m.user._id === session.user.id ? "Leave" : "Remove"}</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
