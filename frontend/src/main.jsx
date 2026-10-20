import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// No StrictMode on purpose: it would open the camera and socket twice in development
createRoot(document.getElementById("root")).render(<App />);
