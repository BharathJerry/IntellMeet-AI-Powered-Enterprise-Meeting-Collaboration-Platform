import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export default function Login({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      onAuth(await api(`/auth/${mode}`, { method: "POST", body }));
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const gbtn = useRef();
  const googleId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleId) return;
    const init = () => {
      window.google.accounts.id.initialize({
        client_id: googleId,
        callback: async (r) => {
          try { onAuth(await api("/auth/google", { method: "POST", body: { credential: r.credential } })); }
          catch (e) { setErr(e.message); }
        },
      });
      window.google.accounts.id.renderButton(gbtn.current, { theme: "outline", size: "large", width: 300 });
    };
    if (window.google?.accounts) return init();
    const sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client";
    sc.async = true;
    sc.onload = init;
    document.head.appendChild(sc);
  }, []);

  // Demo account for judges: logs in, or creates it on first use
  const demo = async () => {
    setErr("");
    const body = { email: "demo@intellmeet.app", password: "DemoPass123" };
    try {
      onAuth(await api("/auth/login", { method: "POST", body }));
    } catch {
      try { onAuth(await api("/auth/signup", { method: "POST", body: { name: "Demo User", ...body } })); }
      catch (e) { setErr(e.message); }
    }
  };

  return (
    <div className="auth">
      <div className="auth-layout">
        <aside className="auth-aside">
          <div className="auth-brand"><span className="auth-brand-mark" aria-hidden="true">IM</span><span>IntellMeet</span></div>
          <div className="auth-aside-copy">
            <span className="auth-aside-label">MEET WITH PURPOSE</span>
            <h2>Make every conversation count.</h2>
            <p>Bring your meetings, decisions, and next steps into one focused workspace.</p>
          </div>
          <span className="auth-aside-footer">A clearer way to work together.</span>
        </aside>
        <form className="card authbox" onSubmit={submit}>
          <div className="auth-form-heading">
            <span className="auth-kicker">YOUR WORKSPACE, IN SYNC</span>
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="muted">{mode === "login" ? "Sign in to pick up where your team left off." : "Get your team set up on IntellMeet."}</p>
          </div>
          {mode === "signup" && <label className="auth-field"><span>Full name</span><input aria-label="Full name" placeholder="Your name" value={form.name} onChange={set("name")} required /></label>}
          <label className="auth-field"><span>Email address</span><input type="email" aria-label="Email" placeholder="you@company.com" value={form.email} onChange={set("email")} required /></label>
          <label className="auth-field"><span>Password</span><input type="password" aria-label="Password (min 8 characters)" placeholder="At least 8 characters" value={form.password} onChange={set("password")} required /></label>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="primary">{mode === "login" ? "Sign in" : "Create account"} <span aria-hidden="true">→</span></button>
          {googleId && <div ref={gbtn} className="gbtn" />}
          <div className="auth-switch">
            <span className="muted">{mode === "login" ? "New to IntellMeet?" : "Already have an account?"}</span>
            <button type="button" className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </div>
          <div className="demo">
            <button type="button" className="ghost" onClick={demo}>Try the demo workspace <span aria-hidden="true">→</span></button>
            <details className="demo-details">
              <summary>What can I try in the demo?</summary>
              <ol className="small muted">
                <li>Open a second browser window to test a meeting with another participant.</li>
                <li>Create a meeting, then join it from the second window.</li>
                <li>Try video, chat, screen sharing, and transcription in the meeting.</li>
              </ol>
            </details>
          </div>
        </form>
      </div>
    </div>
  );
}
