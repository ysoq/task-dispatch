const config = require('../../config');
const { v4: uuidv4 } = require('uuid');
// 导入数据库管理器
const dbManager = require('../../utils/dbManager');

class TerminalManager {
  constructor() {
    // 不需要在内存中存储任务历史，使用数据库
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
      const existingTerminal = dbManager.getTerminal(id);
      if (existingTerminal) {
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

      // 保存到数据库
      const result = dbManager.registerTerminal(terminal);

      if (result) {
        console.log(`终端 ${id} (类型: ${type}) 注册成功`);
        return { success: true, terminalId: id, message: '终端注册成功' };
      } else {
        return { success: false, message: '终端注册失败' };
      }
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
    try {
      return dbManager.getAllTerminals();
    } catch (error) {
      console.error('获取所有终端失败:', error);
      return [];
    }
  }

  /**
   * 搜索终端
   * @param {string} searchQuery - 搜索关键词
   * @returns {Array} 匹配的终端列表
   */
  searchTerminals(searchQuery) {
    try {
      return dbManager.searchTerminals(searchQuery);
    } catch (error) {
      console.error('搜索终端失败:', error);
      return [];
    }
  }

  /**
   * 获取指定终端信息
   * @param {string} terminalId - 终端ID
   * @returns {Object|null} 终端信息或null
   */
  getTerminal(terminalId) {
    try {
      return dbManager.getTerminal(terminalId) || null;
    } catch (error) {
      console.error(`获取终端 ${terminalId} 失败:`, error);
      return null;
    }
  }

  /**
   * 更新终端状态
   * @param {string} terminalId - 终端ID
   * @param {string} status - 终端状态 ('online', 'offline', 'busy')
   * @returns {Object} 更新结果
   */
  updateTerminalStatus(terminalId, status) {
    try {
      const result = dbManager.updateTerminalStatus(terminalId, status);
      if (result) {
        return { success: true, message: '终端状态更新成功' };
      } else {
        return { success: false, message: '终端不存在或更新失败' };
      }
    } catch (error) {
      console.error(`更新终端 ${terminalId} 状态失败:`, error);
      return { success: false, message: `终端状态更新失败: ${error.message}` };
    }
  }

  /**
   * 为终端分配任务
   * @param {string} terminalId - 终端ID
   * @param {Object} task - 任务对象
   * @returns {Object} 分配结果
   */
  assignTaskToTerminal(terminalId, task) {
    try {

      // 准备任务数据
      const taskToCreate = {
        id: task.taskId,
        terminalId: terminalId,
        taskData: task,
        priority: task.priority || 'medium',
        status: 'pending'
      };

      // 创建任务
      const createResult = dbManager.createTask(taskToCreate);
      if (!createResult) {
        return { success: false, message: '任务创建失败' };
      }

      console.log(`任务 ${task.taskId} 已分配给终端 ${terminalId}`);
      return { success: true, message: '任务分配成功' };
    } catch (error) {
      console.error(`任务分配失败:`, error);
      return { success: false, message: `任务分配失败: ${error.message}` };
    }
  }

  /**
   * 终端获取待执行任务
   * @param {string} terminalId - 终端ID
   * @returns {Object|null} 任务对象或null
   */
  getNextTaskForTerminal(terminalId) {
    try {
      // 获取终端的任务队列
      const tasks = dbManager.getTerminalTasks(terminalId, 'pending');
      if (!tasks || tasks.length === 0) {
        return null;
      }
      const task = tasks[0].task_data
      return {
        taskId: task.taskId,
        ...task.taskData,
      };
    } catch (error) {
      console.error(`获取终端 ${terminalId} 任务失败:`, error);
      return null;
    }
  }

  /**
   * 终端上传任务结果
   * @param {string} taskId - 任务ID
   * @param {Object} result - 任务结果
   * @returns {Object} 上传结果
   */
  uploadTaskResult(taskId, result) {
    try {
      // 更新任务状态为完成
      dbManager.updateTaskStatus(taskId, 'completed');

      // 保存任务结果
      const resultToSave = {
        id: uuidv4().substring(0, 8),
        taskId: taskId,
        resultData: result,
        status: 'success'
      };
      dbManager.saveTaskResult(resultToSave);

      console.log(`上传任务 ${taskId} 结果成功`);
      return { success: true, message: '任务结果上传成功' };
    } catch (error) {
      console.error(`上传任务 ${taskId} 结果失败:`, error);
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
      const result = dbManager.getTaskResult(taskId);
      return result ? result.result_data : null;
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
    try {
      // 从数据库获取终端的所有任务
      const tasks = dbManager.getTerminalTasks(terminalId);
      // 按创建时间倒序排序并限制数量
      return tasks
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit)
        .map(task => ({
          taskId: task.id,
          assignedAt: task.created_at,
          startedAt: task.started_at,
          completedAt: task.completed_at,
          status: task.status,
          taskData: task.task_data
        }));
    } catch (error) {
      console.error(`获取终端 ${terminalId} 任务历史失败:`, error);
      return [];
    }
  }
}

module.exports = new TerminalManager();