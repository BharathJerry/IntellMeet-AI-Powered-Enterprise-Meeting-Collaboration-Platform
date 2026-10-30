import { lazy, Suspense, useEffect, useState } from "react";
import { api, getSession, setSession } from "./api.js";
import { startSocket, stopSocket } from "./socket.js";
import Toasts from "./Toasts.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import "./styles.css";
import "./more.css";
import "./more2.css";
import "./extras.css";
import "./redesign.css";
import "./present.css"
const Lobby = lazy(() => import("./pages/Lobby.jsx"));
const Room = lazy(() => import("./pages/Room.jsx"));
const History = lazy(() => import("./pages/History.jsx"));
const Details = lazy(() => import("./pages/Details.jsx"));
const Boards = lazy(() => import("./pages/Boards.jsx"));
const Team = lazy(() => import("./pages/Team.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Invite = lazy(() => import("./pages/Invite.jsx"));
const NAV_GROUPS = [
  ["Workspace", [
    ["dash", "▤", "Dashboard"], ["home", "⌂", "Meetings"], ["history", "◷", "History"],
  ]],
  ["Collaboration", [
    ["boards", "▦", "Boards"], ["team", "♧", "Team"],
  ]],
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
      <nav className="rail" aria-label="Main navigation">
        <div className="logo"><span className="logo-mark">IM</span><span className="logo-name">IntellMeet</span></div>
        {NAV_GROUPS.map(([group, items]) => (
          <div className="nav-group" key={group} role="group" aria-label={group}>
            <span className="nav-section">{group}</span>
            <div className="nav-list">
              {items.map(([name, icon, label]) => (
                <button
                  key={name}
                  type="button"
                  className={`nav ${page.name === name ? "on" : ""}`}
                  title={label}
                  aria-label={label}
                  aria-current={page.name === name ? "page" : undefined}
                  onClick={() => go(name)}
                >
                  <span className="nav-icon" aria-hidden="true">{icon}</span>
                  <span className="nav-label">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="nav-spacer" aria-hidden="true" />
        <button className="me" type="button" title="Profile" aria-label={`Profile for ${session.user.name}`} onClick={() => go("profile")}>
          {session.user.avatar ? <img src={session.user.avatar} alt="" /> : <span className="me-avatar">{initials}</span>}
          <span className="me-copy"><strong>{session.user.name}</strong><small>Account settings</small></span>
          <span className="me-chevron" aria-hidden="true">↗</span>
        </button>
      </nav>
      <main id="main">
         <Suspense fallback={<p className="muted">Loading…</p>}>
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
        </Suspense>
      </main>
      <Toasts />
    </div>
  );
}
