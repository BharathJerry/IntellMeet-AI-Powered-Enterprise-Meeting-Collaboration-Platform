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

  return (
    <div className="auth">
      <form className="card authbox" onSubmit={submit}>
        <h1>IntellMeet</h1>
        <p className="muted">AI-powered meetings and collaboration</p>
        {mode === "signup" && <input placeholder="Full name" value={form.name} onChange={set("name")} required />}
        <input type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
        <input type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={set("password")} required />
        {err && <div className="err">{err}</div>}
        <button className="primary">{mode === "login" ? "Log in" : "Create account"}</button>
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "New here? Sign up" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
