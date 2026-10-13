// PM2 process definition. Secrets are read by Next.js from /opt/wct-training-rq/.env.
module.exports = {
  apps: [
    {
      name: "wct-training-rq",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3010 -H 127.0.0.1",
      env: { NODE_ENV: "production" },
      instances: 1,
      max_memory_restart: "768M",
      kill_timeout: 10000,
      time: true,
    },
  ],
};
