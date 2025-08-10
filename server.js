const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// 引入配置
const config = require('./src/config');

// 创建Express应用
const app = express();
// 解析JSON请求体
app.use(express.json());

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

// 初始化任务管理器
taskManager.init(connectionManager);

// 任务结果处理器无需初始化，已通过单例模式自动初始化

// 引入终端管理器
const terminalManager = require('./src/core/terminal/TerminalManager');

// 引入API路由
const terminalApi = require('./src/api/terminal');
const taskApi = require('./src/api/task');

// 挂载API路由
app.use('/api/terminal', terminalApi);
app.use('/api/task', taskApi);

// 终端管理器不需要初始化，构造函数已完成必要设置

// WebSocket连接处理由connectionManager内部管理
// 无需在此处添加额外处理逻辑

// 定义登录校验中间件
const checkLogin = (req, res, next) => {
    // 从请求头获取Authorization
    const authHeader = req.headers.authorization;

    // 检查是否存在Authorization
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Task Dispatch System"');
        return res.status(401).json({
            success: false,
            message: '未提供身份验证信息'
        });
    }

    // 解析Authorization (Basic认证)
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    // 验证固定账号密码
    if (username === 'ysok' && password === '123456') {
        return next(); // 验证通过，继续处理请求
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Task Dispatch System"');
        return res.status(401).json({
            success: false,
            message: '账号或密码错误'
        });
    }
};

app.get('/', checkLogin, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});
app.get('/dashboard', checkLogin, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});
app.get('/tasks', checkLogin, (req, res) => {
  res.sendFile(__dirname + '/public/terminal-tasks.html');
});

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`WebSocket服务器已集成在ConnectionManager中，通过端口 ${PORT} 上运行`);
  console.log(`API服务已启动，可访问 /api/terminal 和 /api/task 接口`);
});