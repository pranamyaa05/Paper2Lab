// Starts the FastAPI backend (port 8000) and the Vite frontend (port 5173) together.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const procs = [
  spawn(path.join(root, "backend/.venv/bin/uvicorn"), ["app.main:app", "--reload", "--port", "8000"], { cwd: path.join(root, "backend"), stdio: "inherit" }),
  spawn("npx", ["vite"], { cwd: root, stdio: "inherit" }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
