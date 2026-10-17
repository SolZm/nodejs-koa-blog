module.exports = {
  apps: [
    {
      name: 'blog', // pm2 启动/重载时使用的应用名
      // 固定工作目录为配置文件所在目录，避免因调用位置不同而跑错目录
      cwd: __dirname,
      exec_mode: 'cluster', // 集群模式
      // 单实例即可支持零停机 reload；需要横向扩容时改成 'max'
      instances: 1,
      script: './node_modules/nuxt/bin/nuxt.js', // 启动脚本
      args: 'start',
      // Nuxt 服务端启动可能超过 PM2 默认的 3s，放宽到 10s，避免被误判为启动失败而反复重启
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        // 必须与 nginx proxy_pass 指向的端口一致，改端口时两边要一起改
        PORT: 3008,
      },
    },
  ]
}
