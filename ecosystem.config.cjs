module.exports = {
  apps: [{
    name: 'factor-api',
    script: './packages/shared/server.js',
    cwd: '/var/www/factor_UI',
    args: '--host 127.0.0.1 --port 5000 --ws --rest',
    env: {
      NODE_ENV: 'production',
      PORT: '5000',
      HOST: '127.0.0.1'
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
