import { useEffect, useState } from "react";
import { api, getSession, setSession } from "./api.js";
import { startSocket, stopSocket } from "./socket.js";
import Toasts from "./Toasts.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Lobby from "./pages/Lobby.jsx";
import Room from "./pages/Room.jsx";
import History from "./pages/History.jsx";
import Details from "./pages/Details.jsx";
import Boards from "./pages/Boards.jsx";
import Team from "./pages/Team.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Profile from "./pages/Profile.jsx";
import Invite from "./pages/Invite.jsx";
import "./styles.css";
import "./more.css";
import "./more2.css";
import "./extras.css";

const NAV = [
  ["home", "⌂", "Meetings"], ["history", "◷", "History"], ["boards", "▦", "Boards"],
  ["team", "♧", "Team"], ["dash", "▤", "Dashboard"],
];

export default function App() {
  const [session, setSess] = useState(getSession());
  const [page, setPage] = useState(() => {
    const code = new URLSearchParams(window.location.search).get("invite");
    return code ? { name: "invite", code } : { name: "home" };
  });
  const go = (name, extra = {}) => setPage({ name, ...extra });
  const dismissInvite = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url);
    go("home");
  };

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
  const lobby = (id) => go("lobby", { id });

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <nav className="rail" aria-label="Main">
        <div className="logo">IM</div>
        {NAV.map(([name, icon, label]) => (
          <button key={name} className={`nav ${page.name === name ? "on" : ""}`} title={label} aria-label={label} onClick={() => go(name)}>{icon}</button>
        ))}
        <button className="me" title="Profile" aria-label="Profile" onClick={() => go("profile")}>{session.user.avatar ? <img src={session.user.avatar} alt="" /> : initials}</button>
      </nav>
      <main id="main">
        {page.name === "home" && <Home session={session} openRoom={lobby} />}
        {page.name === "lobby" && <Lobby meetingId={page.id} onJoin={(initial) => go("room", { id: page.id, initial })} onBack={() => go("home")} />}
        {page.name === "room" && <Room meetingId={page.id} initial={page.initial} session={session} onLeave={() => go("home")} />}
        {page.name === "history" && <History openDetails={(id) => go("details", { id })} />}
        {page.name === "details" && <Details id={page.id} session={session} onBack={() => go("history")} openRoom={lobby} />}
        {page.name === "boards" && <Boards />}
        {page.name === "team" && <Team session={session} />}
        {page.name === "dash" && <Dashboard />}
        {page.name === "profile" && <Profile session={session} onSignOut={signOut} onUser={(u) => { const next = { ...session, user: u }; setSession(next); setSess(next); }} />}
        {page.name === "invite" && <Invite code={page.code} onBack={dismissInvite} openRoom={lobby} />}
      </main>
      <Toasts />
    </div>
  );
}
