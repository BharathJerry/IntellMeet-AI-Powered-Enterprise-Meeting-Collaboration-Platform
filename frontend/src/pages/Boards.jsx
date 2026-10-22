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
    <div>
      <h2>Boards</h2>
      {err && <div className="err">{err}</div>}
      <div className="row">
        <select aria-label="Workspace" value={ws} onChange={(e) => setWs(e.target.value)}>
          {wss.length === 0 && <option value="">No workspace yet</option>}
          {wss.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </select>
        <form className="row" onSubmit={addWs}>
          <input aria-label="New workspace name" placeholder="New workspace name" value={wsName} onChange={(e) => setWsName(e.target.value)} required minLength={2} />
          <button className="ghost">Create workspace</button>
        </form>
      </div>

      {ws && (
        <>
          <form className="card row" onSubmit={addBoard}>
            <input aria-label="New board name (e.g. Sprint 1)" placeholder="New board name (e.g. Sprint 1)" value={bName} onChange={(e) => setBName(e.target.value)} required minLength={2} />
            <button className="primary">Add board</button>
          </form>
          <div className="grid">
            {boards.map((b) => (
              <button key={b._id} className="card boardcard" onClick={() => setOpen(b._id)}>
                <h4>{b.name}</h4>
                <span className="muted small">Open board →</span>
              </button>
            ))}
            {boards.length === 0 && <p className="muted">No boards in this workspace yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
