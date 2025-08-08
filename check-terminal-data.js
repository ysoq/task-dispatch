const sqlite3 = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'cache.db');

// 连接数据库
const db = sqlite3(dbPath);

console.log('开始检查终端数据...');

try {
  // 查询所有终端数据
  const terminals = db.prepare('SELECT * FROM cache WHERE key LIKE ?').all('terminal:%');

  console.log(`找到 ${terminals.length} 条终端记录:`);
  terminals.forEach((terminal, index) => {
    console.log(`\n记录 ${index + 1}:`);
    console.log(`键: ${terminal.key}`);
    console.log(`过期时间: ${terminal.expiry ? new Date(terminal.expiry).toISOString() : '永不过期'}`);

    try {
      // 尝试解析值
      const value = JSON.parse(terminal.value);
      console.log('值:');
      console.log(JSON.stringify(value, null, 2));
    } catch (error) {
      console.error('解析值失败:', error);
      console.log('原始值:', terminal.value);
    }
  });

  // 检查是否有值为undefined或格式错误的记录
  const invalidTerminals = terminals.filter(terminal => {
    try {
      const value = JSON.parse(terminal.value);
      return value === undefined || value.id === undefined;
    } catch (error) {
      return true;
    }
  });

  if (invalidTerminals.length > 0) {
    console.log(`\n发现 ${invalidTerminals.length} 条无效的终端记录:`);
    invalidTerminals.forEach((terminal, index) => {
      console.log(`\n无效记录 ${index + 1}:`);
      console.log(`键: ${terminal.key}`);
      console.log(`原始值: ${terminal.value}`);
    });
  } else {
    console.log('\n没有发现无效的终端记录。');
  }

} catch (error) {
  console.error('查询终端数据失败:', error);
} finally {
  // 关闭数据库连接
  db.close();
  console.log('\n数据库连接已关闭。');
}