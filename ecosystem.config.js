module.exports = {
  apps: [
    {
      name: 'kanban-app',
      cwd: './kanban-app',
      // Start Next.js directly so we can pass the port
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 8777',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 8777,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8777,
      },

      // Process management
      instances: 1,          // Use 'max' to cluster across CPUs
      exec_mode: 'fork',     // Use 'cluster' with instances>1 if desired
      watch: false,          // Set true only for development
      autorestart: true,
      max_restarts: 10,
      time: true,            // Timestamp logs

      // Optional logs (uncomment to enable)
      // out_file: './.pm2/out.log',
      // error_file: './.pm2/error.log',
      // merge_logs: true,
    },
  ],
};

