export default function Profile({ session, onSignOut }) {
  const u = session.user;
  const initials = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="card profile">
      <div className="bigme" aria-hidden="true">{initials}</div>
      <h2>{u.name}</h2>
      <p className="muted">{u.email}</p>
      <p>Account role: <b>{u.role}</b></p>
      <button className="ghost" onClick={onSignOut}>Sign out</button>
    </div>
  );
}
