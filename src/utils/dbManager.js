const path = require('path');
const sqlite3 = require('better-sqlite3');
const dayjs = require('dayjs')

/**
 * 数据库管理类，负责终端、任务和结果表的操作
 */
class DBManager {
  constructor() {
    // 数据库文件路径
    this.dbPath = path.join(__dirname, '../../cache.db');
    // 连接数据库
    this.db = sqlite3(this.dbPath);
    // 初始化表结构
    this._initTables();
  }

  /**
   * 初始化数据库表
   * @private
   */
  _initTables() {
    try {
      // 创建终端表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS terminals (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          metadata TEXT,
          registered_at INTEGER NOT NULL,
          last_active_at INTEGER NOT NULL,
          status TEXT NOT NULL
        );
      `);

      // 创建任务表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          terminal_id TEXT,
          task_data TEXT NOT NULL,
          priority TEXT DEFAULT 'medium',
          status TEXT DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          started_at INTEGER,
          completed_at INTEGER,
          FOREIGN KEY (terminal_id) REFERENCES terminals(id)
        );
      `);

      // 创建处理结果表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS task_results (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          result_data TEXT,
          status TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id)
        );
      `);

      console.log('数据库表初始化成功');
    } catch (error) {
      console.error('数据库表初始化失败:', error);
    }
  }

  // ===================== 终端表操作 =====================

  /**
   * 注册新终端
   * @param {Object} terminal - 终端信息
   * @returns {boolean} - 是否注册成功
   */
  registerTerminal(terminal) {
    try {
      this.db.prepare(
        'INSERT OR REPLACE INTO terminals (id, type, metadata, registered_at, last_active_at, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        terminal.id,
        terminal.type,
        terminal.metadata ? JSON.stringify(terminal.metadata) : null,
        terminal.registeredAt || Date.now(),
        terminal.lastActiveAt || Date.now(),
        terminal.status || 'online'
      );
      return true;
    } catch (error) {
      console.error(`注册终端失败 (${terminal.id}):`, error);
      return false;
    }
  }

  /**
   * 获取终端信息
   * @param {string} terminalId - 终端ID
   * @returns {Object|null} - 终端信息
   */
  getTerminal(terminalId) {
    try {
      const row = this.db.prepare('SELECT * FROM terminals WHERE id = ?').get(terminalId);
      if (!row) return null;

      // 解析JSON字段
      if (row.metadata) {
        row.metadata = JSON.parse(row.metadata);
      }

      return row;
    } catch (error) {
      console.error(`获取终端失败 (${terminalId}):`, error);
      return null;
    }
  }

  /**
   * 更新终端状态
   * @param {string} terminalId - 终端ID
   * @param {string} status - 终端状态
   * @returns {boolean} - 是否更新成功
   */
  updateTerminalStatus(terminalId, status) {
    try {
      const result = this.db.prepare(
        'UPDATE terminals SET status = ?, last_active_at = ? WHERE id = ?'
      ).run(status, Date.now(), terminalId);

      return result.changes > 0;
    } catch (error) {
      console.error(`更新终端状态失败 (${terminalId}):`, error);
      return false;
    }
  }

  /**
   * 获取所有终端
   * @returns {Object[]} - 终端列表
   */
  getAllTerminals() {
    return this.searchTerminals('')
  }

  /**
   * 搜索终端
   * @param {string} searchQuery - 搜索关键词
   * @returns {Object[]} - 匹配的终端列表
   */
  searchTerminals(searchQuery) {
    try {
      const rows = this.db.prepare('SELECT * FROM terminals WHERE id LIKE ? order by last_active_at desc').all(`%${searchQuery}%`);

      // 解析JSON字段
      return rows.map(row => {
        if (row.metadata) {
          row.metadata = JSON.parse(row.metadata);
        }
        if (row.last_active_at) {
          row.last_active_at = dayjs(row.last_active_at).format('YYYY-MM-DD HH:mm:ss')
        } else {
          row.last_active_at = ''
        }
        // 根据最后在线时间判断在线状态，超过10分钟认为已离线
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        if (row.last_active_at) {
          const lastActiveTime = new Date(row.last_active_at).getTime();
          if (lastActiveTime < tenMinutesAgo) {
            row.status = 'offline';
          }
        }
        return row;
      });
    } catch (error) {
      console.error('搜索终端失败:', error);
      return [];
    }
  }

  /**
   * 获取在线终端
   * @returns {Object[]} - 在线终端列表
   */
  getOnlineTerminals() {
    try {
      const rows = this.db.prepare('SELECT * FROM terminals WHERE status = ?').all('online');

      // 解析JSON字段
      return rows.map(row => {
        if (row.metadata) {
          row.metadata = JSON.parse(row.metadata);
        }
        return row;
      });
    } catch (error) {
      console.error('获取在线终端失败:', error);
      return [];
    }
  }

  // ===================== 任务表操作 =====================

  /**
   * 创建新任务
   * @param {Object} task - 任务信息
   * @returns {boolean} - 是否创建成功
   */
  createTask(task) {
    try {
      this.db.prepare(
        'INSERT INTO tasks (id, terminal_id, task_data, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        task.id,
        task.terminalId || null,
        JSON.stringify(task.taskData),
        task.priority || 'medium',
        task.status || 'pending',
        Date.now()
      );
      return true;
    } catch (error) {
      console.error(`创建任务失败 (${task.id}):`, error);
      return false;
    }
  }

  /**
   * 获取任务信息
   * @param {string} taskId - 任务ID
   * @returns {Object|null} - 任务信息
   */
  getTask(taskId) {
    try {
      const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      if (!row) return null;

      // 解析JSON字段
      row.task_data = JSON.parse(row.task_data);

      return row;
    } catch (error) {
      console.error(`获取任务失败 (${taskId}):`, error);
      return null;
    }
  }

  /**
   * 更新任务状态
   * @param {string} taskId - 任务ID
   * @param {string} status - 任务状态
   * @returns {boolean} - 是否更新成功
   */
  updateTaskStatus(taskId, status) {
    try {
      const now = Date.now();
      const params = [status, now];
      let query = 'UPDATE tasks SET status = ?, ';

      if (status === 'processing') {
        query += 'started_at = ? ';
      } else if (status === 'completed' || status === 'failed') {
        query += 'completed_at = ? ';
      }

      query += 'WHERE id = ?';
      params.push(taskId);

      const result = this.db.prepare(query).run(...params);
      return result.changes > 0;
    } catch (error) {
      console.error(`更新任务状态失败 (${taskId}):`, error);
      return false;
    }
  }

  /**
   * 获取终端的任务队列
   * @param {string} terminalId - 终端ID
   * @returns {Object[]} - 任务列表
   */
  getTerminalTasks(terminalId, status) {
    try {
      let query = 'SELECT * FROM tasks WHERE terminal_id = ?';
      const params = [terminalId];
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      query += ' ORDER BY created_at ASC';
      const rows = this.db.prepare(query).all(...params);

      // 解析JSON字段
      return rows.map(row => {
        row.task_data = JSON.parse(row.task_data);
        return row;
      });
    } catch (error) {
      console.error(`获取终端任务失败 (${terminalId}):`, error);
      return [];
    }
  }

  // ===================== 结果表操作 =====================

  /**
   * 保存任务结果
   * @param {Object} result - 结果信息
   * @returns {boolean} - 是否保存成功
   */
  saveTaskResult(result) {
    try {
      this.db.prepare(
        'INSERT INTO task_results (id, task_id, result_data, status, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(
        result.id,
        result.taskId,
        result.resultData ? JSON.stringify(result.resultData) : null,
        result.status,
        Date.now()
      );
      return true;
    } catch (error) {
      console.error(`保存任务结果失败 (${result.id}):`, error);
      return false;
    }
  }

  /**
   * 获取任务结果
   * @param {string} taskId - 任务ID
   * @returns {Object|null} - 结果信息
   */
  getTaskResult(taskId) {
    try {
      const row = this.db.prepare('SELECT * FROM task_results WHERE task_id = ?').get(taskId);
      if (!row) return null;

      // 解析JSON字段
      if (row.result_data) {
        row.result_data = JSON.parse(row.result_data);
      }

      return row;
    } catch (error) {
      console.error(`获取任务结果失败 (${taskId}):`, error);
      return null;
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    try {
      this.db.close();
    } catch (error) {
      console.error('关闭数据库连接失败:', error);
    }
  }
}

// 创建单例实例并导出
const dbManager = new DBManager();

module.exports = dbManager;