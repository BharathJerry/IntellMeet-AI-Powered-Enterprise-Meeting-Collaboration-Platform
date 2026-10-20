import { useEffect, useState } from "react";
import { api, getSession, setSession } from "./api.js";
import { startSocket, stopSocket } from "./socket.js";
import Toasts from "./Toasts.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Room from "./pages/Room.jsx";
import Boards from "./pages/Boards.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import "./more.css";

const NAV = [["home", "🏠", "Meetings"], ["boards", "🗂", "Boards"], ["dash", "📊", "Dashboard"]];

export default function App() {
  const [session, setSess] = useState(getSession());
  const [page, setPage] = useState({ name: "home" });

  useEffect(() => {
    if (!session) return;
    startSocket();
    return stopSocket;
  }, [!!session]);

  if (!session) return <Login onAuth={(s) => { setSession(s); setSess(s); }} />;

  const signOut = () =>
    api("/auth/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => { setSession(null); setSess(null); });
  const initials = session.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app">
      <nav className="rail" aria-label="Main">
        <div className="logo">IM</div>
        {NAV.map(([name, icon, label]) => (
          <button key={name} className={`nav ${page.name === name ? "on" : ""}`} title={label} aria-label={label} onClick={() => setPage({ name })}>{icon}</button>
        ))}
        <button className="nav" title="Sign out" aria-label="Sign out" onClick={signOut}>⏻</button>
        <div className="me" title={session.user.name}>{initials}</div>
      </nav>
      <main>
        {page.name === "room" && <Room meetingId={page.id} session={session} onLeave={() => setPage({ name: "home" })} />}
        {page.name === "home" && <Home session={session} openRoom={(id) => setPage({ name: "room", id })} />}
        {page.name === "boards" && <Boards />}
        {page.name === "dash" && <Dashboard />}
      </main>
      <Toasts />
    </div>
  );
}
