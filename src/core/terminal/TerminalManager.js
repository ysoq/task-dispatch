const NodeCache = require('node-cache');
const config = require('../../config');
const { v4: uuidv4 } = require('uuid');

// 创建本地缓存实例
const terminalCache = new NodeCache({ stdTTL: config.storage.localCache.ttl });

class TerminalManager {
  constructor() {
    // 存储所有已注册的终端
    this.terminals = new Map();
    // 存储终端任务历史
    this.terminalTaskHistory = new Map();
  }

  /**
   * 注册新终端
   * @param {Object} terminalInfo - 终端信息
   * @param {string} terminalInfo.type - 终端类型
   * @param {string} [terminalInfo.id] - 终端标识，如果不提供则自动生成
   * @param {Object} [terminalInfo.metadata] - 终端元数据
   * @returns {Object} 注册结果，包含终端ID和状态
   */
  registerTerminal(terminalInfo) {
    try {
      const { type, id = uuidv4().substring(0, 8), metadata = {} } = terminalInfo;

      if (!type) {
        return { success: false, message: '终端类型不能为空' };
      }

      // 检查终端是否已存在
      if (this.terminals.has(id)) {
        return { success: false, message: '终端已存在' };
      }

      // 创建终端对象
      const terminal = {
        id,
        type,
        metadata,
        registeredAt: Date.now(),
        lastActiveAt: Date.now(),
        status: 'online'
      };

      // 存储终端信息
      this.terminals.set(id, terminal);

      // 保存到缓存
      terminalCache.set(`terminal:${id}`, terminal);

      console.log(`终端 ${id} (类型: ${type}) 注册成功`);
      return { success: true, terminalId: id, message: '终端注册成功' };
    } catch (error) {
      console.error('终端注册失败:', error);
      return { success: false, message: `终端注册失败: ${error.message}` };
    }
  }

  /**
   * 获取所有已注册的终端
   * @returns {Array} 终端列表
   */
  getAllTerminals() {
    return Array.from(this.terminals.values());
  }

  /**
   * 获取指定终端信息
   * @param {string} terminalId - 终端ID
   * @returns {Object|null} 终端信息或null
   */
  getTerminal(terminalId) {
    return this.terminals.get(terminalId) || null;
  }

  /**
   * 更新终端状态
   * @param {string} terminalId - 终端ID
   * @param {string} status - 终端状态 ('online', 'offline', 'busy')
   * @returns {Object} 更新结果
   */
  updateTerminalStatus(terminalId, status) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return { success: false, message: '终端不存在' };
    }

    terminal.status = status;
    terminal.lastActiveAt = Date.now();

    // 更新缓存
    terminalCache.set(`terminal:${terminalId}`, terminal);

    return { success: true, message: '终端状态更新成功' };
  }

  /**
   * 为终端分配任务
   * @param {string} terminalId - 终端ID
   * @param {Object} task - 任务对象
   * @returns {Object} 分配结果
   */
  assignTaskToTerminal(terminalId, task) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return { success: false, message: '终端不存在' };
    }

    if (terminal.status !== 'online') {
      return { success: false, message: '终端不在线' };
    }

    // 将任务添加到终端的任务队列
    if (!terminal.taskQueue) {
      terminal.taskQueue = [];
    }

    terminal.taskQueue.push(task);
    terminal.status = 'busy';

    // 添加到任务历史
    if (!this.terminalTaskHistory.has(terminalId)) {
      this.terminalTaskHistory.set(terminalId, []);
    }
    this.terminalTaskHistory.get(terminalId).push({
      taskId: task.taskId,
      assignedAt: Date.now(),
      status: 'pending',
      taskData: task
    });

    // 更新缓存
    terminalCache.set(`terminal:${terminalId}`, terminal);

    console.log(`任务 ${task.taskId} 已分配给终端 ${terminalId}`);
    return { success: true, message: '任务分配成功' };
  }

  /**
   * 终端获取待执行任务
   * @param {string} terminalId - 终端ID
   * @returns {Object|null} 任务对象或null
   */
  getNextTaskForTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || !terminal.taskQueue || terminal.taskQueue.length === 0) {
      return null;
    }

    // 获取队列中的第一个任务
    const task = terminal.taskQueue.shift();

    // 更新最后活动时间
    terminal.lastActiveAt = Date.now();
    terminal.status = 'online';

    // 更新缓存
    terminalCache.set(`terminal:${terminalId}`, terminal);

    return task;
  }

  /**
   * 终端上传任务结果
   * @param {string} terminalId - 终端ID
   * @param {string} taskId - 任务ID
   * @param {Object} result - 任务结果
   * @returns {Object} 上传结果
   */
  uploadTaskResult(terminalId, taskId, result) {
    try {
      // 这里可以实现将任务结果存储到数据库或缓存
      terminalCache.set(`task:result:${taskId}`, result);

      // 更新任务历史状态
      if (this.terminalTaskHistory.has(terminalId)) {
        const taskHistory = this.terminalTaskHistory.get(terminalId);
        const taskIndex = taskHistory.findIndex(t => t.taskId === taskId);
        if (taskIndex !== -1) {
          taskHistory[taskIndex].status = 'completed';
          taskHistory[taskIndex].completedAt = Date.now();
          taskHistory[taskIndex].result = result;
        }
      }

      // 更新终端状态
      const terminal = this.terminals.get(terminalId);
      if (terminal) {
        terminal.lastActiveAt = Date.now();
        // 如果没有更多任务，将状态设为在线
        if (!terminal.taskQueue || terminal.taskQueue.length === 0) {
          terminal.status = 'online';
        }
        terminalCache.set(`terminal:${terminalId}`, terminal);
      }

      console.log(`终端 ${terminalId} 上传任务 ${taskId} 结果成功`);
      return { success: true, message: '任务结果上传成功' };
    } catch (error) {
      console.error(`终端 ${terminalId} 上传任务 ${taskId} 结果失败:`, error);
      return { success: false, message: `任务结果上传失败: ${error.message}` };
    }
  }

  /**
   * 获取任务结果
   * @param {string} taskId - 任务ID
   * @returns {Object|null} 任务结果或null
   */
  getTaskResult(taskId) {
    try {
      const result = terminalCache.get(`task:result:${taskId}`);
      return result || null;
    } catch (error) {
      console.error(`获取任务 ${taskId} 结果失败:`, error);
      return null;
    }
  }
  /**
   * 获取终端任务历史
   * @param {string} terminalId - 终端ID
   * @param {number} limit - 限制返回的任务数量
   * @returns {Array} 任务历史列表
   */
  getTerminalTaskHistory(terminalId, limit = 10) {
    if (!this.terminalTaskHistory.has(terminalId)) {
      return [];
    }
    // 返回最近的任务，按分配时间倒序
    return [...this.terminalTaskHistory.get(terminalId)]
      .sort((a, b) => b.assignedAt - a.assignedAt)
      .slice(0, limit);
  }
}

module.exports = new TerminalManager();