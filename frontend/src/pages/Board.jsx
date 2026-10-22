import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const COLS = [["todo", "To Do"], ["in_progress", "In Progress"], ["done", "Done"]];

export default function Board({ id, onBack }) {
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [err, setErr] = useState("");
  const drag = useRef(null);

  const load = () => api(`/boards/${id}`).then(setData).catch((e) => setErr(e.message));

  useEffect(() => { load(); }, [id]);

  // live updates: other members' changes arrive as "board:update" socket events
  useEffect(() => {
    const on = (e) => e.detail.boardId === id && load();
    window.addEventListener("board-update", on);
    return () => window.removeEventListener("board-update", on);
  }, [id]);

  const wsId = data?.board.workspace;
  useEffect(() => {
    if (wsId) api(`/workspaces/${wsId}`).then((d) => setMembers(d.workspace.members.map((m) => m.user))).catch(() => {});
  }, [wsId]);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api(`/boards/${id}/tasks`, { method: "POST", body: { title, ...(assignee && { assignee }) } });
      setTitle("");
      load();
    } catch (e2) { setErr(e2.message); }
  };

  // Moves a card to a column, before `beforeId` (or to the end). Position sits between its new neighbours.
  const move = async (task, status, beforeId) => {
    if (beforeId === task._id) return;
    const col = data.columns[status].filter((t) => t._id !== task._id);
    const idx = beforeId ? Math.max(0, col.findIndex((t) => t._id === beforeId)) : col.length;
    const prev = col[idx - 1]?.position ?? 0;
    const next = col[idx]?.position;
    const position = next === undefined ? prev + 1000 : (prev + next) / 2;

    setData((d) => { // show the move immediately
      const columns = {};
      COLS.forEach(([k]) => (columns[k] = d.columns[k].filter((t) => t._id !== task._id)));
      columns[status] = [...columns[status].slice(0, idx), { ...task, status, position }, ...columns[status].slice(idx)];
      return { ...d, columns };
    });
    try {
      await api(`/boards/${id}/tasks/${task._id}`, { method: "PATCH", body: { status, position } });
    } catch (e) { setErr(e.message); load(); }
  };

  const shift = (task, dir) => {
    const i = COLS.findIndex(([k]) => k === task.status) + dir;
    if (COLS[i]) move(task, COLS[i][0]);
  };

  const remove = async (t) => {
    try { await api(`/boards/${id}/tasks/${t._id}`, { method: "DELETE" }); load(); } catch (e) { setErr(e.message); }
  };

  if (!data) return <p className="muted">{err || "Loading board…"}</p>;

  return (
    <div>
      <header className="board-heading">
        <button className="ghost" onClick={onBack} aria-label="Back to boards"><span aria-hidden="true">←</span> Boards</button>
        <div><span className="page-eyebrow">PROJECT BOARD</span><h2>{data.board.name}</h2></div>
        <span className="board-task-total"><b>{COLS.reduce((sum, [key]) => sum + data.columns[key].length, 0)}</b> tasks</span>
      </header>
      {err && <div className="err">{err}</div>}
      <form className="board-add-form card" onSubmit={add}>
        <span className="board-add-icon" aria-hidden="true">＋</span>
        <input aria-label="Add a card" placeholder="What needs to get done?" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
        <select aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Assign to anyone</option>
          {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
        <button className="primary">Add task <span aria-hidden="true">→</span></button>
      </form>

      <div className="kanban">
        {COLS.map(([key, label]) => (
          <div key={key} className={`kcol board-column board-column-${key}`} onDragOver={(e) => e.preventDefault()} onDrop={() => drag.current && move(drag.current, key)}>
            <h4><span>{label}</span><span className="board-column-count">{data.columns[key].length}</span></h4>
            <span className="board-column-hint">{key === "todo" ? "Ready to start" : key === "in_progress" ? "Currently working on" : "Completed work"}</span>
            {data.columns[key].map((t) => (
              <div
                key={t._id}
                className="kcard"
                draggable
                onDragStart={() => (drag.current = t)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.stopPropagation(); drag.current && move(drag.current, key, t._id); }}
              >
                <div>{t.title}</div>
                <div className="krow">
                  <span className="board-assignee"><span className="board-assignee-avatar" aria-hidden="true">{t.assignee ? t.assignee.name.slice(0, 1).toUpperCase() : "·"}</span><span className="small muted">{t.assignee ? t.assignee.name : "Unassigned"}</span></span>
                  <span>
                    <button aria-label="Move left" disabled={key === "todo"} onClick={() => shift(t, -1)}>◀</button>
                    <button aria-label="Move right" disabled={key === "done"} onClick={() => shift(t, 1)}>▶</button>
                    <button aria-label="Delete card" onClick={() => remove(t)}>✕</button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
