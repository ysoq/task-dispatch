try {
  const sqlite3 = require('better-sqlite3');
  console.log('better-sqlite3模块加载成功');
  const db = new sqlite3(':memory:');
  console.log('数据库创建成功');
  db.close();
  console.log('测试成功完成');
} catch (error) {
  console.error('测试失败:', error);
}