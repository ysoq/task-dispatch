const { v4: uuidv4 } = require('uuid');
const http = require('http');
const TerminalManager = require('./src/core/terminal/TerminalManager');
const ConnectionManager = require('./src/core/connection/ConnectionManager');
const dbManager = require('./src/utils/dbManager');

// 创建HTTP服务器用于测试ConnectionManager
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('测试服务器运行中');
});

// 启动服务器
server.listen(3001, () => {
  console.log('测试服务器运行在 http://localhost:3001');
});

// 创建连接管理器实例
const connectionManager = new ConnectionManager(server);

// 测试函数
async function runTests() {
  console.log('开始系统集成测试...\n');

  try {
    // 1. 测试终端注册
    console.log('=== 测试终端注册 ===');
    const terminalId = 'test-term-' + uuidv4().slice(0, 6);
    const registerResult = TerminalManager.registerTerminal({
      id: terminalId,
      type: 'test-terminal',
      metadata: { name: '集成测试终端', version: '1.0.0' }
    });
    console.log('注册终端结果:', registerResult);

    // 验证终端是否在数据库中
    const dbTerminal = dbManager.getTerminal(terminalId);
    console.log('数据库中的终端:', dbTerminal);

    // 2. 测试终端状态更新
    console.log('\n=== 测试终端状态更新 ===');
    // 模拟终端连接
    connectionManager._updateTerminalStatus(terminalId, 'online');
    // 检查状态
    let status = connectionManager.getTerminalStatus(terminalId);
    console.log('更新后的终端状态:', status);

    // 3. 测试任务分配
    console.log('\n=== 测试任务分配 ===');
    const taskId = 'test-task-' + uuidv4().slice(0, 6);
    const task = {
      taskId: taskId,
      action: 'process',
      data: '集成测试任务数据',
      priority: 'high'
    };
    const assignResult = TerminalManager.assignTaskToTerminal(terminalId, task);
    console.log('分配任务结果:', assignResult);

    // 检查终端状态是否变为忙碌
    status = connectionManager.getTerminalStatus(terminalId);
    console.log('分配任务后终端状态:', status);

    // 4. 测试获取任务
    console.log('\n=== 测试获取任务 ===');
    const nextTask = TerminalManager.getNextTaskForTerminal(terminalId);
    console.log('获取的任务:', nextTask);

    // 5. 测试上传任务结果
    console.log('\n=== 测试上传任务结果 ===');
    const result = {
      success: true,
      output: '任务处理成功',
      data: { result: '测试结果数据' }
    };
    const uploadResult = TerminalManager.uploadTaskResult(terminalId, taskId, result);
    console.log('上传结果:', uploadResult);

    // 检查终端状态是否变回在线
    status = connectionManager.getTerminalStatus(terminalId);
    console.log('上传结果后终端状态:', status);

    // 6. 测试获取任务结果
    console.log('\n=== 测试获取任务结果 ===');
    const taskResult = TerminalManager.getTaskResult(taskId);
    console.log('任务结果:', taskResult);

    // 7. 测试获取任务历史
    console.log('\n=== 测试获取任务历史 ===');
    const taskHistory = TerminalManager.getTerminalTaskHistory(terminalId);
    console.log('任务历史:', taskHistory);

    // 8. 测试获取在线终端
    console.log('\n=== 测试获取在线终端 ===');
    const onlineTerminals = connectionManager.getOnlineTerminals();
    console.log('在线终端列表:', onlineTerminals);
    console.log('在线终端数量:', onlineTerminals.length);

    console.log('\n所有测试完成!');
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    // 关闭服务器和数据库连接
    server.close(() => {
      console.log('测试服务器已关闭');
      dbManager.close();
    });
  }
}

// 运行测试
runTests();