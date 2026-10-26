import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export function resolveStartArguments(args, env = { LANDING_PORT: process.env.LANDING_PORT, PORT: process.env.PORT }) {
  const supplied = args.some(arg => arg === "--port" || arg === "-p" || arg.startsWith("--port=") || /^-p\d/.test(arg));
  if (supplied) return ["start", ...args];
  const port = env.LANDING_PORT || env.PORT || "5002";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("LANDING_PORT or PORT must be an integer between 1 and 65535.");
  return ["start", "--port", port, ...args];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const require = createRequire(import.meta.url);
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), ...resolveStartArguments(process.argv.slice(2))], { stdio: "inherit" });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exitCode = code ?? 1; });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
}