import { useState } from "react";
import { api } from "../api.js";
import { toast } from "../toast.js";

// Crops to a square and shrinks to a 160px JPEG, so the upload stays tiny
const toJpeg = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = 160;
      c.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 160, 160);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the image"))), "image/jpeg", 0.85);
    };
    img.onerror = () => reject(new Error("That file is not an image"));
    img.src = URL.createObjectURL(file);
  });

export default function Profile({ session, onSignOut, onUser }) {
  const u = session.user;
  const [name, setName] = useState(u.name);
  const [err, setErr] = useState("");
  const initials = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const guard = (fn) => async (...a) => {
    setErr("");
    try { await fn(...a); } catch (e) { setErr(e.message); }
  };

  const pick = guard(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const d = await api("/users/me/avatar", { method: "PUT", body: await toJpeg(file) });
    onUser(d.user);
    toast("Profile photo updated");
  });

  const save = guard(async (e) => {
    e.preventDefault();
    const d = await api("/users/me", { method: "PATCH", body: { name } });
    onUser(d.user);
    toast("Name updated");
  });

  return (
    <div className="profile-page">
      <header className="page-heading"><div><span className="page-eyebrow">ACCOUNT</span><h2>Your profile</h2><p className="muted">Manage your personal account details.</p></div></header>
      <section className="profile-card card">
        <div className="profile-cover"><span className="profile-cover-orb profile-cover-orb-one" /><span className="profile-cover-orb profile-cover-orb-two" /><span className="profile-cover-mark">IM</span></div>
        <div className="profile-card-content">
          <div className="profile-avatar" aria-hidden="true">{u.avatar ? <img src={u.avatar} alt="" /> : initials}</div>
          <span className="profile-label">INTELLMEET ACCOUNT</span>
          <h3>{u.name}</h3>
          <p className="muted">{u.email}</p>
          {err && <div className="err" role="alert">{err}</div>}
          <form className="profile-edit-form" onSubmit={save}>
            <label htmlFor="profile-name">Display name</label>
            <div><input id="profile-name" aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /><button className="primary" disabled={name === u.name}>Save</button></div>
          </form>
          <div className="profile-details">
            <div><span className="profile-detail-icon" aria-hidden="true">◎</span><span><small>Account name</small><b>{u.name}</b></span></div>
            <div><span className="profile-detail-icon" aria-hidden="true">@</span><span><small>Email address</small><b>{u.email}</b></span></div>
            <div><span className="profile-detail-icon" aria-hidden="true">◇</span><span><small>Workspace role</small><b className="profile-role">{u.role}</b></span></div>
          </div>
          <div className="profile-footer">
            <label className="ghost profile-photo-button">Change photo<input type="file" accept="image/*" onChange={pick} hidden /></label>
            <span className="muted small">Signed in as {u.email}</span>
            <button className="profile-signout" onClick={onSignOut}>Sign out <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </section>
    </div>
  );
}
