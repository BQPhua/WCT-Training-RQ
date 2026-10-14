// PM2 process definition. Runs from the `current` release symlink so every
// reload picks up the newly switched release. Secrets: shared/.env (symlinked
// into each release as .env, which Next.js loads).
const APP_ROOT = process.env.APP_ROOT || "/opt/wct-training-rq";

module.exports = {
  apps: [
    {
      name: "wct-training-rq",
      cwd: `${APP_ROOT}/current`,
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${process.env.PORT || 3110} -H 127.0.0.1`,
      env: { NODE_ENV: "production", TZ: "Asia/Kuala_Lumpur" },
      instances: 1,
      max_memory_restart: "768M",
      kill_timeout: 10000,
      time: true,
    },
  ],
};
