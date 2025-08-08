const { v4: uuidv4 } = require('uuid');
const dbManager = require('./src/utils/dbManager');

// 测试函数
async function runTests() {
  console.log('开始测试数据库表...\n');

  try {
    // 1. 测试终端表
    console.log('=== 测试终端表 ===');
    const terminalId = 'test-terminal-' + uuidv4().slice(0, 8);
    const terminal = {
      id: terminalId,
      type: 'test-terminal',
      metadata: { name: '测试终端', version: '1.0.0' },
      registeredAt: Date.now(),
      lastActiveAt: Date.now(),
      status: 'online'
    };

    // 注册终端
    const registerResult = dbManager.registerTerminal(terminal);
    console.log('注册终端结果:', registerResult);

    // 获取终端
    const fetchedTerminal = dbManager.getTerminal(terminalId);
    console.log('获取终端结果:', fetchedTerminal);

    // 更新终端状态
    const updateResult = dbManager.updateTerminalStatus(terminalId, 'busy');
    console.log('更新终端状态结果:', updateResult);

    // 再次获取终端验证更新
    const updatedTerminal = dbManager.getTerminal(terminalId);
    console.log('更新后的终端状态:', updatedTerminal.status);

    // 获取所有终端
    const allTerminals = dbManager.getAllTerminals();
    console.log('所有终端数量:', allTerminals.length);

    // 获取在线终端
    const onlineTerminals = dbManager.getOnlineTerminals();
    console.log('在线终端数量:', onlineTerminals.length);

    // 2. 测试任务表
    console.log('\n=== 测试任务表 ===');
    const taskId = 'test-task-' + uuidv4().slice(0, 8);
    const task = {
      id: taskId,
      terminalId: terminalId,
      taskData: { action: 'process', data: '测试任务数据' },
      priority: 'high',
      status: 'pending'
    };

    // 创建任务
    const createTaskResult = dbManager.createTask(task);
    console.log('创建任务结果:', createTaskResult);

    // 获取任务
    const fetchedTask = dbManager.getTask(taskId);
    console.log('获取任务结果:', fetchedTask);

    // 更新任务状态为处理中
    const startTaskResult = dbManager.updateTaskStatus(taskId, 'processing');
    console.log('开始处理任务结果:', startTaskResult);

    // 更新任务状态为完成
    const completeTaskResult = dbManager.updateTaskStatus(taskId, 'completed');
    console.log('完成任务结果:', completeTaskResult);

    // 获取终端的任务队列
    const terminalTasks = dbManager.getTerminalTasks(terminalId);
    console.log('终端任务数量:', terminalTasks.length);

    // 3. 测试结果表
    console.log('\n=== 测试结果表 ===');
    const resultId = 'test-result-' + uuidv4().slice(0, 8);
    const result = {
      id: resultId,
      taskId: taskId,
      resultData: { success: true, output: '测试任务成功完成' },
      status: 'success'
    };

    // 保存结果
    const saveResult = dbManager.saveTaskResult(result);
    console.log('保存结果结果:', saveResult);

    // 获取结果
    const fetchedResult = dbManager.getTaskResult(taskId);
    console.log('获取结果结果:', fetchedResult);

    console.log('\n所有测试完成!');
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    // 关闭数据库连接
    dbManager.close();
  }
}

// 运行测试
runTests();