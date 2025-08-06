const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');
const config = require('../../config');

// 创建本地缓存实例
const localCache = new NodeCache({ stdTTL: config.storage.localCache.ttl });

class ConnectionManager {
  constructor(server) {
    this.wss = new WebSocket.Server({
      server,
      path: config.websocket.path
    });
    this.connections = new Map(); // 存储WebSocket连接
    this.terminalStatus = new Map(); // 存储终端状态

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
      this._updateTerminalStatus(terminalId, 'online');

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

        if (!hasTerminalConnections) {
          this._updateTerminalStatus(terminalId, 'offline');
        }
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
    const lastActive = Date.now();
    this.terminalStatus.set(terminalId, {
      status,
      lastActive
    });

    // 同步到本地缓存
    localCache.set(`terminal:${terminalId}`, {
      status,
      lastActive
    });

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

          if (!hasTerminalConnections) {
            this._updateTerminalStatus(ws.terminalId, 'offline');
          }
        }
      });
    }, config.websocket.heartbeatInterval);
  }

  // 获取终端状态
  getTerminalStatus(terminalId) {
    // 先检查内存中的状态
    if (this.terminalStatus.has(terminalId)) {
      return this.terminalStatus.get(terminalId);
    }

    // 从本地缓存中获取
    const status = localCache.get(`terminal:${terminalId}`);
    if (status) {
      return status;
    }

    // 如果都没有，返回默认状态
    return { status: 'unknown', lastActive: 0 };
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
    const onlineTerminals = [];
    this.terminalStatus.forEach((status, terminalId) => {
      if (status.status === 'online') {
        onlineTerminals.push(terminalId);
      }
    });
    return onlineTerminals;
  }

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