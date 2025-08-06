// 系统配置
module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },

  // WebSocket配置
  websocket: {
    path: '/ws',
    heartbeatInterval: 30000, // 心跳间隔30秒
    heartbeatTimeout: 60000,  // 心跳超时60秒
    maxPayload: 1048576       // 最大负载1MB
  },

  // 任务配置
  task: {
    defaultTimeout: 300000,  // 默认任务超时5分钟
    queueCapacity: 10000,    // 队列容量
    retryAttempts: 3,        // 重试次数
    retryDelay: 10000        // 重试延迟10秒
  },

  // 存储配置
  storage: {
    // 本地缓存配置
    localCache: {
      ttl: 3600 // 默认过期时间1小时
    }
  },

  // 日志配置
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV !== 'production'
  },

  // 终端配置
  terminal: {
    maxOfflineTasks: 100,  // 终端离线时最多存储的任务数
    statusCheckInterval: 60000 // 终端状态检查间隔1分钟
  }
};