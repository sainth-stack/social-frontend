// PM2 production config
// API :5000 | App (frontend) :5001 | Marketing (landing) :5002
//
//   ./scripts/pm2-start.sh
//   ./scripts/pm2-stop.sh
//
// Env overrides: PORT, FRONTEND_PORT, LANDING_PORT

const fs = require("fs");
const path = require("path");

const BACKEND = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(BACKEND, "..");

function firstExistingDir(candidates) {
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[candidates.length - 1];
}

function resolveFrontend() {
  return firstExistingDir([
    path.join(REPO_ROOT, "social-frontend"),
    path.join(REPO_ROOT, "frontend"),
  ]);
}

function resolveLanding() {
  return firstExistingDir([
    path.join(REPO_ROOT, "social-landing"),
    path.join(REPO_ROOT, "landing"),
  ]);
}

function pythonBin() {
  for (const name of [".venv", "venv"]) {
    const py = path.join(BACKEND, name, "bin", "python");
    if (fs.existsSync(py)) return py;
  }
  return "python3";
}

function nextApp({ name, appDir, port, logs }) {
  const nextBin = path.join(appDir, "node_modules/next/dist/bin/next");
  return {
    name,
    cwd: appDir,
    script: fs.existsSync(nextBin) ? nextBin : "npx",
    args: fs.existsSync(nextBin) ? `start -p ${port}` : `next start -p ${port}`,
    env: { NODE_ENV: "production" },
    out_file: path.join(logs, `${name}.log`),
    error_file: path.join(logs, `${name}.log`),
  };
}

const PYTHON = pythonBin();
const FRONTEND = resolveFrontend();
const LANDING = resolveLanding();
const LOGS = path.join(BACKEND, ".run");
const PORT = process.env.PORT || "5000";
const FRONTEND_PORT = process.env.FRONTEND_PORT || "5001";
const LANDING_PORT = process.env.LANDING_PORT || "5002";

const base = {
  cwd: BACKEND,
  interpreter: "none",
  autorestart: true,
  max_restarts: 15,
  min_uptime: "10s",
  merge_logs: true,
  time: true,
};

module.exports = {
  apps: [
    {
      ...base,
      name: "social-media-api",
      script: PYTHON,
      args: `-m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 2`,
      out_file: path.join(LOGS, "api.log"),
      error_file: path.join(LOGS, "api.log"),
    },
    {
      ...base,
      name: "social-media-worker",
      script: PYTHON,
      args: "-m celery -A workers.celery_app:celery_app worker -l info -Q social_publish,social_analytics,social_maintenance -P prefork -c 4 -n worker@%h",
      out_file: path.join(LOGS, "worker.log"),
      error_file: path.join(LOGS, "worker.log"),
    },
    {
      ...base,
      name: "social-media-beat",
      script: PYTHON,
      args: "-m celery -A workers.celery_app:celery_app beat -l info",
      out_file: path.join(LOGS, "beat.log"),
      error_file: path.join(LOGS, "beat.log"),
    },
    {
      ...base,
      ...nextApp({
        name: "social-media-frontend",
        appDir: FRONTEND,
        port: FRONTEND_PORT,
        logs: LOGS,
      }),
    },
    {
      ...base,
      ...nextApp({
        name: "social-media-landing",
        appDir: LANDING,
        port: LANDING_PORT,
        logs: LOGS,
      }),
    },
  ],
};
