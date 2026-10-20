// Fire a toast from anywhere: toast("Saved") or toast("Failed", "bad")
export const toast = (text, kind = "ok") =>
  window.dispatchEvent(new CustomEvent("toast", { detail: { text, kind } }));
