const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const NodeCache = require('node-cache');

// 创建Express应用
const app = express();
// 静态文件服务
app.use(express.static('public'));

// 创建HTTP服务器
const server = http.createServer(app);

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 创建本地缓存实例
const cache = new NodeCache({ stdTTL: 3600 }); // 默认过期时间1小时

// WebSocket连接处理
wss.on('connection', (ws) => {
  console.log('新的WebSocket连接已建立');

  // 向客户端发送欢迎消息
  ws.send(JSON.stringify({
    type: 'welcome',
    message: '欢迎连接到WebSocket服务器!'
  }));

  // 处理客户端消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 处理不同类型的消息
      switch (data.type) {
        case 'cache_set':
          // 设置缓存
          cache.set(data.key, data.value, data.ttl);
          ws.send(JSON.stringify({
            type: 'cache_set_success',
            key: data.key,
            message: '缓存设置成功'
          }));
          break;

        case 'cache_get':
          // 获取缓存
          const value = cache.get(data.key);
          ws.send(JSON.stringify({
            type: 'cache_get_response',
            key: data.key,
            value: value,
            message: value !== undefined ? '缓存获取成功' : '缓存键不存在'
          }));
          break;

        case 'cache_delete':
          // 删除缓存
          const deleted = cache.del(data.key);
          ws.send(JSON.stringify({
            type: 'cache_delete_response',
            key: data.key,
            success: deleted,
            message: deleted ? '缓存删除成功' : '缓存键不存在'
          }));
          break;

        case 'cache_clear':
          // 清空缓存
          cache.flushAll();
          ws.send(JSON.stringify({
            type: 'cache_clear_success',
            message: '缓存已清空'
          }));
          break;

        default:
          // 未知消息类型
          ws.send(JSON.stringify({
            type: 'error',
            message: '未知的消息类型'
          }));
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '消息解析错误: ' + error.message
      }));
    }
  });

  // 处理连接关闭
  ws.on('close', () => {
    console.log('WebSocket连接已关闭');
  });
});

// 路由
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`WebSocket服务器也在端口 ${PORT} 上运行`);
});