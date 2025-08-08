// 测试SQLite缓存持久性
const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 测试数据
const testKey = 'persistence-test';
const testValue = { message: 'This data should persist after restart' };

// 检查数据库文件是否存在
const dbPath = path.join(__dirname, 'cache.db');
console.log(`数据库文件路径: ${dbPath}`);
console.log(`数据库文件存在: ${fs.existsSync(dbPath)}`);

// 连接数据库
const db = sqlite3(dbPath);
// 查询有几条数据
const count = db.prepare('SELECT COUNT(*) as count FROM cache').get().count;
console.log(`数据库中已存在 ${count} 条数据`);

// 设置测试数据
console.log('插入测试数据...');
db.prepare('INSERT OR REPLACE INTO cache (key, value, expiry) VALUES (?, ?, ?)')
  .run(testKey, JSON.stringify(testValue), Date.now() + 3600000);
console.log('测试数据插入成功');

// 读取测试数据
const row = db.prepare('SELECT * FROM cache WHERE key = ?').get(testKey);
if (row) {
  console.log('读取到的测试数据:', JSON.stringify(row));
} else {
  console.log('未找到测试数据');
}

// 关闭连接
db.close();
console.log('测试完成，请重启服务后运行此脚本检查数据是否持久化');