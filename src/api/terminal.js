const express = require('express');
const router = express.Router();
const terminalManager = require('../core/terminal/TerminalManager');

/**
 * @route POST /api/terminal/register
 * @desc 注册新终端
 * @access Public
 */
router.post('/register', (req, res) => {
  const terminalInfo = req.body;
  const result = terminalManager.registerTerminal(terminalInfo);
  res.json(result);
});

/**
 * @route GET /api/terminal
 * @desc 获取所有终端
 * @access Public
 */
router.get('/', (req, res) => {
  const terminals = terminalManager.getAllTerminals();
  res.json(terminals);
});

/**
 * @route GET /api/terminal/:id
 * @desc 获取指定终端信息
 * @access Public
 */
router.get('/:id', (req, res) => {
  const terminal = terminalManager.getTerminal(req.params.id);
  if (terminal) {
    res.json(terminal);
  } else {
    res.status(404).json({ success: false, message: '终端不存在' });
  }
});

/**
 * @route PUT /api/terminal/:id/status
 * @desc 更新终端状态
 * @access Public
 */
router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  const result = terminalManager.updateTerminalStatus(req.params.id, status);
  res.json(result);
});

/**
 * @route GET /api/terminal/:id/task
 * @desc 终端获取下一个待执行任务
 * @access Public
 */
router.get('/:id/task', (req, res) => {
  const task = terminalManager.getNextTaskForTerminal(req.params.id);
  if (task) {
    res.json(task);
  } else {
    res.status(204).json({}); // 没有任务
  }
});

/**
 * @route POST /api/terminal/:id/task/result
 * @desc 终端上传任务结果
 * @access Public
 */
router.post('/:id/task/result', (req, res) => {
  const { taskId, result } = req.body;
  const uploadResult = terminalManager.uploadTaskResult(req.params.id, taskId, result);
  res.json(uploadResult);
});

/**
 * @route GET /api/terminal/:id/task/history
 * @desc 获取终端任务历史
 * @access Public
 */
router.get('/:id/task/history', (req, res) => {
  const { limit } = req.query;
  const taskHistory = terminalManager.getTerminalTaskHistory(req.params.id, parseInt(limit) || 10);
  res.json(taskHistory);
});

/**
 * @route GET /api/terminal/:id/task/:taskId/result
 * @desc 获取任务结果
 * @access Public
 */
router.get('/:id/task/:taskId/result', (req, res) => {
  const { taskId } = req.params;
  const result = terminalManager.getTaskResult(taskId);
  if (result) {
    res.json(result);
  } else {
    res.status(404).json({ success: false, message: '任务结果不存在' });
  }
});

module.exports = router;