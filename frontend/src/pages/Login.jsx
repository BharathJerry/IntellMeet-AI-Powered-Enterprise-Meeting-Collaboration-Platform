import { useState } from "react";
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
      <form className="card authbox" onSubmit={submit}>
        <h1>IntellMeet</h1>
        <p className="muted">AI-powered meetings and collaboration</p>
        {mode === "signup" && <input aria-label="Full name" placeholder="Full name" value={form.name} onChange={set("name")} required />}
        <input type="email" aria-label="Email" placeholder="Email" value={form.email} onChange={set("email")} required />
        <input type="password" aria-label="Password (min 8 characters)" placeholder="Password (min 8 characters)" value={form.password} onChange={set("password")} required />
        {err && <div className="err">{err}</div>}
        <button className="primary">{mode === "login" ? "Log in" : "Create account"}</button>
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "New here? Sign up" : "Have an account? Log in"}
        </button>
        <div className="demo">
          <button type="button" className="ghost" onClick={demo}>▶ Try the demo account</button>
          <ol className="small muted">
            <li>Open this page in two browsers (or one normal and one private window).</li>
            <li>Create a meeting in the first, then copy its ID from the Meetings page.</li>
            <li>Join with that ID in the second to test video, chat and screen share.</li>
            <li>Use Transcribe, then AI summary on the host's meeting card.</li>
          </ol>
        </div>
      </form>
    </div>
  );
}
