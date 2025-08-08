const TerminalManager = require('./src/core/terminal/TerminalManager');
const ConnectionManager = require('./src/core/connection/ConnectionManager');
const sqliteCache = require('./src/utils/sqliteCache');

// 测试函数
async function testTerminalStatus() {
  console.log('开始测试终端状态实时从数据库获取...');

  // 清理之前的测试数据
  console.log('清理之前的测试数据...');
  const keys = sqliteCache.keys();
  const terminalKeys = keys.filter(key => key.startsWith('terminal:'));
  if (terminalKeys.length > 0) {
    sqliteCache.mdel(terminalKeys);
    console.log(`已删除 ${terminalKeys.length} 个终端测试数据`);
  }

  // 测试1: 注册终端
  console.log('\n测试1: 注册终端');
  const registerResult = TerminalManager.registerTerminal({
    type: 'test-terminal',
    id: 'test-id-123',
    metadata: { name: '测试终端', version: '1.0.0' }
  });
  console.log('注册结果:', registerResult);

  // 测试2: 获取终端信息
  console.log('\n测试2: 获取终端信息');
  const terminal = TerminalManager.getTerminal('test-id-123');
  console.log('获取到的终端信息:', terminal);

  // 测试3: 更新终端状态
  console.log('\n测试3: 更新终端状态');
  const updateResult = TerminalManager.updateTerminalStatus('test-id-123', 'busy');
  console.log('更新结果:', updateResult);

  // 测试4: 再次获取终端信息，验证状态更新
  console.log('\n测试4: 再次获取终端信息，验证状态更新');
  const updatedTerminal = TerminalManager.getTerminal('test-id-123');
  console.log('更新后的终端信息:', updatedTerminal);
  console.log('状态是否已更新为busy:', updatedTerminal.status === 'busy');

  // 测试5: 获取所有终端
  console.log('\n测试5: 获取所有终端');
  const allTerminals = TerminalManager.getAllTerminals();
  console.log('所有终端数量:', allTerminals.length);
  console.log('所有终端列表:', allTerminals);

  // 测试6: 使用ConnectionManager获取终端状态
  console.log('\n测试6: 使用ConnectionManager获取终端状态');
  // 创建一个真实的HTTP服务器用于测试
  const http = require('http');
  const server = http.createServer();
  const connectionManager = new ConnectionManager(server);
  const status = connectionManager.getTerminalStatus('test-id-123');
  console.log('ConnectionManager获取的终端状态:', status);

  // 测试7: 获取在线终端
  console.log('\n测试7: 获取在线终端');
  // 先更新终端状态为online
  TerminalManager.updateTerminalStatus('test-id-123', 'online');
  const onlineTerminals = connectionManager.getOnlineTerminals();
  console.log('在线终端数量:', onlineTerminals.length);
  console.log('在线终端列表:', onlineTerminals);
  console.log('测试终端是否在在线列表中:', onlineTerminals.includes('test-id-123'));

  // 关闭服务器
  server.close();

  // 测试完成
  console.log('\n测试完成!');
  sqliteCache.close();
}

// 运行测试
testTerminalStatus().catch(err => {
  console.error('测试出错:', err);
  sqliteCache.close();
});