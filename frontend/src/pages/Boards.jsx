import { useEffect, useState } from "react";
import { api } from "../api.js";
import Board from "./Board.jsx";

export default function Boards() {
  const [wss, setWss] = useState([]);
  const [ws, setWs] = useState("");
  const [boards, setBoards] = useState([]);
  const [wsName, setWsName] = useState("");
  const [bName, setBName] = useState("");
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");

  const guard = (fn) => async (...a) => {
    setErr("");
    try { await fn(...a); } catch (e) { setErr(e.message); }
  };

  useEffect(() => {
    guard(async () => {
      const d = await api("/workspaces");
      setWss(d.workspaces);
      if (d.workspaces[0]) setWs(d.workspaces[0]._id);
    })();
  }, []);

  useEffect(() => {
    if (!ws) return setBoards([]);
    api(`/workspaces/${ws}/boards`).then((d) => setBoards(d.boards)).catch((e) => setErr(e.message));
  }, [ws]);

  const addWs = guard(async (e) => {
    e.preventDefault();
    const d = await api("/workspaces", { method: "POST", body: { name: wsName } });
    setWsName("");
    setWss((x) => [d.workspace, ...x]);
    setWs(d.workspace._id);
  });

  const addBoard = guard(async (e) => {
    e.preventDefault();
    const d = await api(`/workspaces/${ws}/boards`, { method: "POST", body: { name: bName } });
    setBName("");
    setBoards((x) => [...x, d.board]);
  });

  if (open) return <Board id={open} onBack={() => setOpen(null)} />;

  return (
    <div className="boards-page">
      <header className="page-heading">
        <div><span className="page-eyebrow">TEAM COLLABORATION</span><h2>Boards</h2><p className="muted">Plan projects, track progress, and keep everyone aligned.</p></div>
        <span className="boards-count"><b>{boards.length}</b><small>{boards.length === 1 ? "board" : "boards"}</small></span>
      </header>
      {err && <div className="err">{err}</div>}
      <section className="boards-workspace card">
        <div className="boards-section-copy"><span className="boards-section-icon" aria-hidden="true">▦</span><div><h3>Workspace</h3><p className="muted small">Choose a workspace or create a new one for your team.</p></div></div>
        <div className="boards-workspace-controls">
          <select aria-label="Workspace" value={ws} onChange={(e) => setWs(e.target.value)}>
            {wss.length === 0 && <option value="">No workspace yet</option>}
            {wss.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <form className="boards-create-workspace" onSubmit={addWs}>
            <input aria-label="New workspace name" placeholder="New workspace name" value={wsName} onChange={(e) => setWsName(e.target.value)} required minLength={2} />
            <button className="ghost">Create workspace</button>
          </form>
        </div>
      </section>

      {ws && (
        <>
          <form className="boards-create-form card" onSubmit={addBoard}>
            <div className="boards-section-copy"><span className="boards-section-icon" aria-hidden="true">＋</span><div><h3>Create a board</h3><p className="muted small">Set up a board for your next project or sprint.</p></div></div>
            <div className="boards-create-fields">
              <input aria-label="New board name (e.g. Sprint 1)" placeholder="e.g. Product launch" value={bName} onChange={(e) => setBName(e.target.value)} required minLength={2} />
              <button className="primary">Create board <span aria-hidden="true">→</span></button>
            </div>
          </form>
          <div className="home-section-heading"><div><span className="page-eyebrow">YOUR PROJECTS</span><h3>Workspace boards</h3></div></div>
          <div className="grid boards-grid">
            {boards.map((b) => (
              <button key={b._id} className="card boardcard" onClick={() => setOpen(b._id)}>
                <span className="boards-card-icon" aria-hidden="true">▦</span>
                <h4>{b.name}</h4>
                <span className="muted small">Open project board <span aria-hidden="true">→</span></span>
              </button>
            ))}
            {boards.length === 0 && <div className="home-empty card"><span aria-hidden="true">▦</span><h4>Your workspace is ready</h4><p className="muted">Create a board above to start organizing work with your team.</p></div>}
          </div>
        </>
      )}
    </div>
  );
}
