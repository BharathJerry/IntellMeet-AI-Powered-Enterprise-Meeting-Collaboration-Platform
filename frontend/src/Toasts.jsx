import { useEffect, useState } from "react";

export default function Toasts() {
  const [list, setList] = useState([]);

  useEffect(() => {
    const on = (e) => {
      const t = { id: Math.random(), ...e.detail };
      setList((l) => [...l, t]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 5000);
    };
    window.addEventListener("toast", on);
    return () => window.removeEventListener("toast", on);
  }, []);

  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
    </div>
  );
}
