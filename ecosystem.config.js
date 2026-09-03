// ── CNH Service — PM2 configuration ─────────────────────────────
// Start the app with PM2:
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   (so it restarts on reboot)
// Logs go to ./logs/pm2-*.log (create the folder first: mkdir -p logs)
module.exports = {
  apps: [
    {
      name: 'cnh-service',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      time: true
    }
  ]
};
