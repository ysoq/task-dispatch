const express = require('express');
const router = express.Router();
const taskManager = require('../core/task/TaskManager');
const taskScheduler = require('../core/task/TaskScheduler');
const terminalManager = require('../core/terminal/TerminalManager');

/**
 * @route POST /api/task/submit
 * @desc 提交新任务
 * @access Public
 */
router.post('/submit', (req, res) => {
  try {
    const taskData = req.body;
    const terminalId = req.query.terminalId;

    // 生成任务ID
    const taskId = taskManager.createTask(taskData);

    if (terminalId) {
      // 直接分配任务给指定终端
      const assignResult = terminalManager.assignTaskToTerminal(terminalId, {
        taskId,
        taskData,
        priority: 'medium',
        addedAt: Date.now()
      });

      if (assignResult.success) {
        res.json({ success: true, taskId, message: '任务已分配到指定终端' });
      } else {
        res.status(400).json({ success: false, message: assignResult.message });
      }
    } else {
      // 添加到任务调度队列
      const priority = req.query.priority || 'medium';
      taskScheduler.scheduleTask(taskData, priority);
      res.json({ success: true, taskId, message: '任务已添加到调度队列' });
    }
  } catch (error) {
    console.error('任务提交失败:', error);
    res.status(500).json({ success: false, message: `任务提交失败: ${error.message}` });
  }
});

/**
 * @route GET /api/task/status/:id
 * @desc 查询任务状态
 * @access Public
 */
router.get('/status/:id', (req, res) => {
  const taskId = req.params.id;
  const task = taskManager.getTask(taskId);

  if (task) {
    res.json({
      taskId: task.taskId,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
  } else {
    res.status(404).json({ success: false, message: '任务不存在' });
  }
});

/**
 * @route GET /api/task/result/:id
 * @desc 获取任务结果
 * @access Public
 */
router.get('/result/:id', (req, res) => {
  const taskId = req.params.id;
  const task = taskManager.getTask(taskId);

  if (task && task.result) {
    res.json({
      taskId: task.taskId,
      result: task.result,
      completedAt: task.completedAt
    });
  } else {
    res.status(404).json({ success: false, message: '任务不存在或结果未生成' });
  }
});

module.exports = router;