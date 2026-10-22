export default function Profile({ session, onSignOut }) {
  const u = session.user;
  const initials = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="profile-page">
      <header className="page-heading"><div><span className="page-eyebrow">ACCOUNT</span><h2>Your profile</h2><p className="muted">Manage your personal account details.</p></div></header>
      <section className="profile-card card">
        <div className="profile-cover"><span className="profile-cover-orb profile-cover-orb-one" /><span className="profile-cover-orb profile-cover-orb-two" /><span className="profile-cover-mark">IM</span></div>
        <div className="profile-card-content">
          <div className="profile-avatar" aria-hidden="true">{initials}</div>
          <span className="profile-label">INTELLMEET ACCOUNT</span>
          <h3>{u.name}</h3>
          <p className="muted">{u.email}</p>
          <div className="profile-details">
            <div><span className="profile-detail-icon" aria-hidden="true">◎</span><span><small>Account name</small><b>{u.name}</b></span></div>
            <div><span className="profile-detail-icon" aria-hidden="true">@</span><span><small>Email address</small><b>{u.email}</b></span></div>
            <div><span className="profile-detail-icon" aria-hidden="true">◇</span><span><small>Workspace role</small><b className="profile-role">{u.role}</b></span></div>
          </div>
          <div className="profile-footer"><span className="muted small">Signed in as {u.email}</span><button className="profile-signout" onClick={onSignOut}>Sign out <span aria-hidden="true">↗</span></button></div>
        </div>
      </section>
    </div>
  );
}
