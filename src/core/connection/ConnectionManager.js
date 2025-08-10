const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
// 导入数据库管理器
const dbManager = require('../../utils/dbManager');
// 导入WebSocket模块
const WebSocketModule = require('ws');

// 使用数据库管理终端状态

class ConnectionManager {
  constructor(server) {
    this.wss = new WebSocketModule.Server({
      server,
      path: config.websocket.path
    });
    this.connections = new Map(); // 存储WebSocket连接

    // 绑定事件处理器
    this._bindEvents();

    // 启动心跳检查
    this._startHeartbeatCheck();
  }

  // 绑定WebSocket事件
  _bindEvents() {
    this.wss.on('connection', (ws, req) => {
      // 从URL中提取终端ID或生成临时ID
      const urlParts = req.url.split('/');
      const terminalId = urlParts[urlParts.length - 1] || uuidv4();

      // 存储连接信息
      const connectionId = uuidv4();
      ws.connectionId = connectionId;
      ws.terminalId = terminalId;
      ws.lastHeartbeat = Date.now();

      this.connections.set(connectionId, ws);

      console.log(`终端 ${terminalId} 已连接，连接ID: ${connectionId}`);

      // 发送连接确认
      ws.send(JSON.stringify({
        type: 'connection_established',
        connectionId,
        terminalId,
        timestamp: Date.now()
      }));

      // 处理消息
      ws.on('message', (data) => {
        this._handleMessage(ws, data);
      });

      // 处理关闭
      ws.on('close', () => {
        this.connections.delete(connectionId);
        console.log(`连接 ${connectionId} 已关闭`);

        // 检查是否还有该终端的其他连接
        const hasTerminalConnections = Array.from(this.connections.values())
          .some(conn => conn.terminalId === terminalId);

      });

      // 处理错误
      ws.on('error', (error) => {
        console.error(`连接 ${connectionId} 错误:`, error);
        this.connections.delete(connectionId);
      });
    });
  }

  // 处理接收到的消息
  _handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      console.log(message)
      switch (message.type) {
        case 'heartbeat':
          // 更新心跳时间
          ws.lastHeartbeat = Date.now();
          // 响应心跳
          ws.send(JSON.stringify({
            type: 'heartbeat_ack',
            timestamp: Date.now()
          }));
          break;

        case 'terminal_status':
          // 更新终端状态
          this._updateTerminalStatus(ws.terminalId, message.status);
          break;

        default:
          console.warn(`未知消息类型: ${message.type}`);
      }
    } catch (error) {
      console.error('消息处理错误:', error);
    }
  }

  // 更新终端状态
  _updateTerminalStatus(terminalId, status) {
    // 检查终端是否存在
    const terminal = dbManager.getTerminal(terminalId);
    if (terminal) {
      // 更新现有终端的状态
      dbManager.updateTerminalStatus(terminalId, status);
    } else {
      // 如果终端不存在，创建一个新的终端记录
      dbManager.registerTerminal({
        id: terminalId,
        type: 'unknown',
        metadata: {},
        registeredAt: Date.now(),
        lastActiveAt: Date.now(),
        status: status
      });
    }

    console.log(`终端 ${terminalId} 状态更新为: ${status}`);
  }

  // 启动心跳检查
  _startHeartbeatCheck() {
    setInterval(() => {
      const now = Date.now();
      const timeout = config.websocket.heartbeatTimeout;

      this.connections.forEach((ws, connectionId) => {
        if (now - ws.lastHeartbeat > timeout) {
          console.log(`连接 ${connectionId} 心跳超时，关闭连接`);
          ws.terminate();
          this.connections.delete(connectionId);

          // 检查是否还有该终端的其他连接
          const hasTerminalConnections = Array.from(this.connections.values())
            .some(conn => conn.terminalId === ws.terminalId);

        }
      });
    }, config.websocket.heartbeatInterval);
  }

  // 获取终端状态
  getTerminalStatus(terminalId) {
    try {
      // 从数据库获取终端信息
      const terminal = dbManager.getTerminal(terminalId);
      if (terminal) {
        return {
          status: terminal.status,
          lastActive: terminal.last_active_at
        };
      }

      // 如果没有，返回默认状态
      return { status: 'unknown', lastActive: 0 };
    } catch (error) {
      console.error(`获取终端 ${terminalId} 状态失败:`, error);
      return { status: 'unknown', lastActive: 0 };
    }
  }

  // 向指定终端发送消息
  sendToTerminal(terminalId, message) {
    let sent = false;

    // 查找该终端的所有连接
    this.connections.forEach((ws) => {
      if (ws.terminalId === terminalId && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          sent = true;
          console.log(`消息已发送到终端 ${terminalId}`);
        } catch (error) {
          console.error(`向终端 ${terminalId} 发送消息失败:`, error);
        }
      }
    });

    return sent;
  }

  // 向所有终端广播消息
  broadcast(message) {
    this.connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('广播消息失败:', error);
        }
      }
    });
  }

  // 获取所有在线终端
  getOnlineTerminals() {
    try {
      // 从数据库获取在线终端
      const onlineTerminals = dbManager.getOnlineTerminals();
      // 只返回终端ID
      return onlineTerminals.map(terminal => terminal.id);
    } catch (error) {
      console.error('获取在线终端失败:', error);
      return [];
    }
  }

  // 不再需要从缓存加载终端状态到内存
  // 所有终端状态操作都直接与数据库交互


  // 关闭所有连接
  closeAllConnections() {
    this.connections.forEach((ws) => {
      ws.terminate();
    });
    this.connections.clear();
    console.log('所有连接已关闭');
  }
}

module.exports = ConnectionManager;