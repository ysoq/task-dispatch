const NodeCache = require('node-cache');
const config = require('../../config');
const taskManager = require('./TaskManager');

// 创建本地缓存实例
const schedulerCache = new NodeCache({ stdTTL: config.storage.localCache.ttl });

class TaskScheduler {
  constructor(connectionManager) {
    // 任务优先级队列
    this.priorityQueues = {
      high: [],
      medium: [],
      low: []
    };
    this.connectionManager = connectionManager;
  }

  // 初始化调度器
  init() {
    this._startScheduler();
  }

  // 添加任务到调度队列
  scheduleTask(taskData, priority = 'medium', terminalId = null) {
    // 验证优先级
    if (!['high', 'medium', 'low'].includes(priority)) {
      priority = 'medium';
    }

    // 生成任务ID
    const taskId = taskManager.createTask(taskData);

    // 如果指定了终端ID且终端在线，直接分配任务
    if (terminalId) {
      const onlineTerminals = this.connectionManager.getOnlineTerminals();
      if (onlineTerminals.includes(terminalId)) {
        taskManager._dispatchTaskToTerminal(taskId, terminalId);
        console.log(`Task ${taskId} directly assigned to terminal ${terminalId}`);
        return taskId;
      } else {
        console.warn(`Terminal ${terminalId} is not online, adding to ${priority} priority queue instead`);
      }
    }

    // 添加到优先级队列
    this.priorityQueues[priority].push({
      taskId,
      taskData,
      priority,
      addedAt: Date.now()
    });

    console.log(`Task ${taskId} added to ${priority} priority queue`);
    return taskId;
  }

  // 启动调度器
  _startScheduler() {
    setInterval(() => {
      this._processTasks();
    }, 1000); // 每秒检查一次队列
  }

  // 处理任务队列
  _processTasks() {
    // 按优先级顺序处理任务
    ['high', 'medium', 'low'].forEach(priority => {
      while (this.priorityQueues[priority].length > 0) {
        const queueItem = this.priorityQueues[priority][0];
        const terminalId = this._selectBestTerminal(queueItem.taskData);

        if (terminalId) {
          // 从队列中移除任务
          this.priorityQueues[priority].shift();

          // 分配任务给选定的终端
          taskManager._dispatchTaskToTerminal(queueItem.taskId, terminalId);
        } else {
          // 没有合适的终端，停止处理队列
          break;
        }
      }
    });
  }

  // 选择最优终端
  _selectBestTerminal(taskData) {
    // 获取所有在线终端
    const onlineTerminals = this.connectionManager.getOnlineTerminals();
    if (onlineTerminals.length === 0) {
      console.warn('No online terminals available');
      return null;
    }

    // 简单的负载均衡：选择当前任务数最少的终端
    let bestTerminalId = null;
    let minTaskCount = Infinity;

    onlineTerminals.forEach(terminalId => {
      // 获取终端的任务数
      const terminalTasks = schedulerCache.get(`terminal:tasks:${terminalId}`) || 0;

      // 如果终端任务数更少，或者相同任务数但响应更快
      if (terminalTasks < minTaskCount) {
        minTaskCount = terminalTasks;
        bestTerminalId = terminalId;
      }
    });

    // 更新选定终端的任务计数
    if (bestTerminalId) {
      const currentTasks = schedulerCache.get(`terminal:tasks:${bestTerminalId}`) || 0;
      schedulerCache.set(`terminal:tasks:${bestTerminalId}`, currentTasks + 1);

      // 任务完成后减少计数的逻辑将在任务状态更新时实现
    }

    return bestTerminalId;
  }

  // 任务完成后更新终端任务计数
  onTaskCompleted(terminalId) {
    if (!terminalId) return;

    const currentTasks = schedulerCache.get(`terminal:tasks:${terminalId}`) || 0;
    if (currentTasks > 0) {
      schedulerCache.set(`terminal:tasks:${terminalId}`, currentTasks - 1);
    }
  }
}

module.exports = TaskScheduler;