module.exports = {
  apps: [
    {
      name: 'dcl-mini',
      script: 'index.js',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
