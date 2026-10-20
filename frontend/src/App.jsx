import { useState } from "react";
import { api, getSession, setSession } from "./api.js";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Room from "./pages/Room.jsx";

export default function App() {
  const [session, setSess] = useState(getSession());
  const [page, setPage] = useState({ name: "home" });

  if (!session)
    return <Login onAuth={(s) => { setSession(s); setSess(s); }} />;

  const signOut = () =>
    api("/auth/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => { setSession(null); setSess(null); });
  const initials = session.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app">
      <nav className="rail">
        <div className="logo">IM</div>
        <button className={`nav ${page.name === "home" ? "on" : ""}`} title="Meetings" onClick={() => setPage({ name: "home" })}>🏠</button>
        <button className="nav" title="Sign out" onClick={signOut}>⏻</button>
        <div className="me" title={session.user.name}>{initials}</div>
      </nav>
      <main>
        {page.name === "room" ? (
          <Room meetingId={page.id} session={session} onLeave={() => setPage({ name: "home" })} />
        ) : (
          <Home session={session} openRoom={(id) => setPage({ name: "room", id })} />
        )}
      </main>
    </div>
  );
}
