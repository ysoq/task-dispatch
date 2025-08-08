const path = require('path');
const config = require('../config');
const sqlite3 = require('better-sqlite3');

/**
 * SQLite缓存工具类，提供与NodeCache相似的API接口
 */
class SQLiteCache {
  constructor() {
    // 数据库文件路径
    this.dbPath = path.join(__dirname, '../../cache.db');
    // 连接数据库
    this.db = sqlite3(this.dbPath);
    // 初始化表结构
    this._initTable();
  }

  /**
   * 初始化缓存表
   * @private
   */
  _initTable() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY,
          value TEXT,
          expiry INTEGER
        );
      `);
      // 创建过期索引
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_cache_expiry ON cache (expiry);');
      // 清理过期数据
      this._cleanupExpired();
      console.log('SQLite缓存表初始化成功');
    } catch (error) {
      console.error('SQLite缓存表初始化失败:', error);
    }
  }

  /**
   * 清理过期的缓存项
   * @private
   */
  _cleanupExpired() {
    // const now = Date.now();
    // this.db.prepare('DELETE FROM cache WHERE expiry < ?').run(now);
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {number} [ttl] - 过期时间(秒)，默认使用配置文件中的值
   * @returns {boolean} - 是否设置成功
   */
  set(key, value, ttl) {
    try {
      const expiry = ttl ? Date.now() + (ttl * 1000) : null;
      const serializedValue = JSON.stringify(value);

      this.db.prepare(
        'INSERT OR REPLACE INTO cache (key, value, expiry) VALUES (?, ?, ?)'
      ).run(key, serializedValue, expiry);

      return true;
    } catch (error) {
      console.error(`设置缓存失败 (${key}):`, error);
      return false;
    }
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {*} - 缓存值，如果不存在或已过期返回undefined
   */
  get(key) {
    try {
      this._cleanupExpired(); // 先清理过期数据

      const row = this.db.prepare('SELECT value, expiry FROM cache WHERE key = ?').get(key);
      console.log('获取缓存原始数据:', row);

      if (!row) return undefined;

      // 检查是否过期
      if (row.expiry && row.expiry < Date.now()) {
        this.del(key);
        return undefined;
      }

      return JSON.parse(row.value);
    } catch (error) {
      console.error(`获取缓存失败 (${key}):`, error);
      return undefined;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   * @returns {number} - 删除的缓存项数量
   */
  del(key) {
    try {
      const result = this.db.prepare('DELETE FROM cache WHERE key = ?').run(key);
      return result.changes;
    } catch (error) {
      console.error(`删除缓存失败 (${key}):`, error);
      return 0;
    }
  }

  /**
   * 同时删除多个缓存
   * @param {string[]} keys - 缓存键数组
   * @returns {number} - 删除的缓存项数量
   */
  mdel(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return 0;

    try {
      let deletedCount = 0;
      const stmt = this.db.prepare('DELETE FROM cache WHERE key = ?');

      this.db.transaction(() => {
        keys.forEach(key => {
          const result = stmt.run(key);
          deletedCount += result.changes;
        });
      })();

      return deletedCount;
    } catch (error) {
      console.error('批量删除缓存失败:', error);
      return 0;
    }
  }

  /**
   * 检查缓存是否存在
   * @param {string} key - 缓存键
   * @returns {boolean} - 是否存在
   */
  has(key) {
    try {
      this._cleanupExpired(); // 先清理过期数据

      const row = this.db.prepare('SELECT 1 FROM cache WHERE key = ?').get(key);
      return !!row;
    } catch (error) {
      console.error(`检查缓存失败 (${key}):`, error);
      return false;
    }
  }

  /**
   * 清除所有缓存
   * @returns {void}
   */
  flush() {
    try {
      this.db.exec('DELETE FROM cache');
    } catch (error) {
      console.error('清除所有缓存失败:', error);
    }
  }

  /**
   * 获取缓存键列表
   * @returns {string[]} - 缓存键数组
   */
  keys() {
    try {
      this._cleanupExpired(); // 先清理过期数据

      const rows = this.db.prepare('SELECT key FROM cache').all();
      return rows.map(row => row.key);
    } catch (error) {
      console.error('获取缓存键列表失败:', error);
      return [];
    }
  }

  /**
   * 关闭数据库连接
   * @returns {void}
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
const sqliteCache = new SQLiteCache();

module.exports = sqliteCache;