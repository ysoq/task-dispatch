const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// 引入配置
const config = require('./src/config');

// 创建Express应用
const app = express();
// 解析JSON请求体
app.use(express.json());
// 静态文件服务
app.use(express.static('public'));

// 创建HTTP服务器
const server = http.createServer(app);

// 引入连接管理器
const ConnectionManager = require('./src/core/connection/ConnectionManager');
const taskManager = require('./src/core/task/TaskManager');
const TaskScheduler = require('./src/core/task/TaskScheduler');
const taskResultProcessor = require('./src/core/task/TaskResultProcessor');

// 初始化连接管理器
const connectionManager = new ConnectionManager(server);

// 初始化任务调度器
const taskScheduler = new TaskScheduler(connectionManager);

taskScheduler.init();

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server, path: config.websocket.path });

// 初始化任务管理器
taskManager.init(connectionManager);

// 任务结果处理器无需初始化，已通过单例模式自动初始化

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  // 从URL路径中提取终端ID
  const urlParts = req.url.split('/');
  const terminalId = urlParts[urlParts.length - 1];

  // 注册终端连接
  connectionManager.registerTerminal(terminalId, ws);

  console.log(`终端 ${terminalId} 已连接`);

  // 向客户端发送欢迎消息
  ws.send(JSON.stringify({
    type: 'welcome',
    message: `欢迎终端 ${terminalId} 连接到WebSocket服务器!`
  }));
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
      case 'heartbeat':
        // 处理心跳
        connectionManager.updateTerminalStatus(terminalId, 'online');
        break;

      case 'task_accept':
        // 接受任务
        taskManager.updateTaskStatus(data.taskId, taskManager.taskStatus.PROCESSING);
        break;

      case 'task_result':
        // 提交任务结果
        taskResultProcessor.processTaskResult(data.taskId, data.result);
        break;

      case 'task_failure':
        // 提交任务失败
        taskResultProcessor.processTaskFailure(data.taskId, new Error(data.error));
        break;

      case 'cache_set':
        // 设置缓存
        connectionManager.setTerminalCache(terminalId, data.key, data.value, data.ttl);
        ws.send(JSON.stringify({
          type: 'cache_set_success',
          key: data.key,
          message: '缓存设置成功'
        }));
        break;

      case 'cache_get':
        // 获取缓存
        const value = connectionManager.getTerminalCache(terminalId, data.key);
        ws.send(JSON.stringify({
          type: 'cache_get_response',
          key: data.key,
          value: value,
          message: value !== undefined ? '缓存获取成功' : '缓存键不存在'
        }));
        break;

      case 'cache_delete':
        // 删除缓存
        const deleted = connectionManager.deleteTerminalCache(terminalId, data.key);
        ws.send(JSON.stringify({
          type: 'cache_delete_response',
          key: data.key,
          success: deleted,
          message: deleted ? '缓存删除成功' : '缓存键不存在'
        }));
        break;

      case 'cache_clear':
        // 清空缓存
        connectionManager.clearTerminalCache(terminalId);
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

// 任务调度API

// 提交新任务
app.post('/api/task/submit', (req, res) => {
  try {
    const taskData = req.body;
    const priority = req.query.priority || 'medium';
    const taskId = taskScheduler.scheduleTask(taskData, priority);
    res.status(201).json({
      taskId,
      message: '任务已提交'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: '提交任务失败'
    });
  }
});

// 查询任务状态
app.get('/api/task/status/:taskId', (req, res) => {
  try {
    const taskId = req.params.taskId;
    const task = taskManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        message: '任务不存在'
      });
    }
    res.json({
      taskId: task.taskId,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: '查询任务状态失败'
    });
  }
});

// 获取任务结果
app.get('/api/task/result/:taskId', (req, res) => {
  try {
    const taskId = req.params.taskId;
    if (!taskResultProcessor.isTaskCompleted(taskId)) {
      return res.status(400).json({
        message: '任务尚未完成'
      });
    }
    const result = taskResultProcessor.getTaskResult(taskId);
    res.json({
      taskId,
      result
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: '获取任务结果失败'
    });
  }
});

// 获取在线终端列表
app.get('/api/terminals', (req, res) => {
  try {
    const terminals = connectionManager.getOnlineTerminals();
    const terminalStatusList = terminals.map(terminalId => ({
      terminalId,
      status: connectionManager.getTerminalStatus(terminalId)
    }));
    res.json(terminalStatusList);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: '获取终端列表失败'
    });
  }
});

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`WebSocket服务器也在端口 ${PORT} 上运行`);
});