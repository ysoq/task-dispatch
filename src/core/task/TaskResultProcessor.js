const NodeCache = require('node-cache');
const config = require('../../config');
const taskManager = require('./TaskManager');
const scheduler = require('./TaskScheduler');

// 创建本地缓存实例
const resultCache = new NodeCache({ stdTTL: config.storage.localCache.ttl });

class TaskResultProcessor {
  constructor() {
    // 注册任务状态更新回调
    this._registerTaskStatusCallback();
  }

  // 注册任务状态更新回调
  _registerTaskStatusCallback() {
    // 这里可以注册一个回调函数，当任务状态更新时被调用
    // 实际实现可能需要修改TaskManager以支持回调
  }

  // 处理任务结果
  processTaskResult(taskId, result) {
    // 更新任务状态为已完成
    const success = taskManager.updateTaskStatus(taskId, taskManager.taskStatus.COMPLETED, result);

    if (success) {
      console.log(`Processed result for task ${taskId}`);
      // 通知调度器任务已完成，更新终端负载
      const task = taskManager.getTask(taskId);
      if (task && task.terminalId) {
        scheduler.onTaskCompleted(task.terminalId);
      }

      // 触发结果通知事件
      this._notifyTaskResult(taskId, result);

      return true;
    } else {
      console.error(`Failed to process result for task ${taskId}`);
      return false;
    }
  }

  // 处理任务失败
  processTaskFailure(taskId, error) {
    // 更新任务状态为失败
    const success = taskManager.updateTaskStatus(taskId, taskManager.taskStatus.FAILED, {
      error: error.message || 'Unknown error'
    });

    if (success) {
      console.log(`Processed failure for task ${taskId}: ${error.message}`);
      // 通知调度器任务已完成，更新终端负载
      const task = taskManager.getTask(taskId);
      if (task && task.terminalId) {
        scheduler.onTaskCompleted(task.terminalId);
      }

      // 触发失败通知事件
      this._notifyTaskFailure(taskId, error);

      return true;
    } else {
      console.error(`Failed to process failure for task ${taskId}`);
      return false;
    }
  }

  // 获取任务结果
  getTaskResult(taskId) {
    return taskManager.getTaskResult(taskId);
  }

  // 检查任务是否完成
  isTaskCompleted(taskId) {
    const task = taskManager.getTask(taskId);
    return task && (task.status === taskManager.taskStatus.COMPLETED || 
                   task.status === taskManager.taskStatus.FAILED || 
                   task.status === taskManager.taskStatus.TIMEOUT);
  }

  // 触发任务结果通知
  _notifyTaskResult(taskId, result) {
    // 这里实现结果通知逻辑，可以是WebSocket推送或其他方式
    // 实际应用中可能需要维护请求端连接信息
    console.log(`Notifying result for task ${taskId}`);
  }

  // 触发任务失败通知
  _notifyTaskFailure(taskId, error) {
    // 这里实现失败通知逻辑
    console.log(`Notifying failure for task ${taskId}: ${error.message}`);
  }
}

module.exports = new TaskResultProcessor();