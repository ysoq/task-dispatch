const { v4: uuidv4Task } = require('uuid');
const NodeCache = require('node-cache');
const config = require('../../config');
const ConnectionManager = require('../connection/ConnectionManager');

// 创建本地缓存实例
const taskCache = new NodeCache({ stdTTL: config.storage.localCache.ttl });

class TaskManager {
  constructor() {
    this.taskStatus = {
      PENDING: 'PENDING',
      DELIVERED: 'DELIVERED',
      PROCESSING: 'PROCESSING',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
      TIMEOUT: 'TIMEOUT'
    };
    this.connectionManager = null;
  }

  // 初始化任务管理器
  init(connectionManager) {
    this.connectionManager = connectionManager;
    this._startTaskMonitor();
  }

  // 创建新任务
  createTask(taskData, terminalId = null) {
    const taskId = `T${Date.now()}_${uuidv4Task().substring(0, 8)}`;
    const task = {
      taskId,
      data: taskData,
      terminalId: terminalId || null,
      status: this.taskStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 存储任务到本地缓存
    taskCache.set(`task:${taskId}`, task);
    console.log(`Created task: ${taskId}`);

    // 如果指定了终端且终端在线，立即推送任务
    if (terminalId) {
      this._dispatchTaskToTerminal(taskId, terminalId);
    }

    return taskId;
  }

  // 分配任务给终端
  async _dispatchTaskToTerminal(taskId, terminalId) {
    const task = taskCache.get(`task:${taskId}`);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    const terminalStatus = this.connectionManager.getTerminalStatus(terminalId);
    if (!terminalStatus || terminalStatus.status !== 'online') {
      console.error(`Terminal ${terminalId} is not online`);
      return;
    }

    // 更新任务状态为已投递
    task.status = this.taskStatus.DELIVERED;
    task.terminalId = terminalId;
    task.updatedAt = Date.now();
    taskCache.set(`task:${taskId}`, task);

    // 推送任务到终端
    const connection = this.connectionManager.getTerminalConnection(terminalId);
    if (connection && connection.readyState === connection.OPEN) {
      connection.send(JSON.stringify({
        type: 'task',
        taskId: task.taskId,
        data: task.data
      }));

      // 设置超时检查
      this._setTaskTimeout(taskId);
    } else {
      console.error(`Failed to send task ${taskId} to terminal ${terminalId}: Connection not found or closed`);
      task.status = this.taskStatus.FAILED;
      task.updatedAt = Date.now();
      taskCache.set(`task:${taskId}`, task);
    }
  }

  // 设置任务超时
  _setTaskTimeout(taskId) {
    setTimeout(async () => {
      const task = taskCache.get(`task:${taskId}`);
      if (task && task.status === this.taskStatus.DELIVERED) {
        console.log(`Task ${taskId} timed out`);
        task.status = this.taskStatus.TIMEOUT;
        task.updatedAt = Date.now();
        taskCache.set(`task:${taskId}`, task);
      }
    }, config.task.defaultTimeout);
  }

  // 更新任务状态
  updateTaskStatus(taskId, status, result = null) {
    const task = taskCache.get(`task:${taskId}`);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return false;
    }

    task.status = status;
    task.updatedAt = Date.now();

    if (result !== null) {
      task.result = result;
      // 存储结果到单独的缓存项
      taskCache.set(`task:result:${taskId}`, result);
    }

    taskCache.set(`task:${taskId}`, task);
    console.log(`Updated task ${taskId} status to ${status}`);
    return true;
  }

  // 获取任务信息
  getTask(taskId) {
    return taskCache.get(`task:${taskId}`);
  }

  // 获取任务结果
  getTaskResult(taskId) {
    return taskCache.get(`task:result:${taskId}`);
  }

  // 启动任务监控
  _startTaskMonitor() {
    setInterval(() => {
      // 此处可以添加任务监控逻辑，例如清理过期任务等
    }, config.task.statusCheckInterval);
  }
}

module.exports = new TaskManager();