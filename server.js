const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 服务静态文件
app.use(express.static('public'));

// 存储连接的客户端和渲染服务器
const connections = {
  renderServers: new Map(),
  clients: new Map()
};

io.on('connection', (socket) => {
  console.log('新连接:', socket.id);

  // 渲染服务器注册
  socket.on('register-render-server', (data) => {
    console.log('渲染服务器注册:', data);
    connections.renderServers.set(socket.id, {
      socket,
      info: data
    });
    
    // 通知所有客户端有新的渲染服务器可用
    socket.broadcast.emit('render-server-available', {
      id: socket.id,
      info: data
    });
  });

  // 客户端注册
  socket.on('register-client', (data) => {
    console.log('客户端注册:', data);
    connections.clients.set(socket.id, {
      socket,
      info: data
    });
    
    // 发送可用的渲染服务器列表
    const availableServers = Array.from(connections.renderServers.entries()).map(([id, server]) => ({
      id,
      info: server.info
    }));
    
    socket.emit('available-render-servers', availableServers);
  });

  // 请求连接到渲染服务器
  socket.on('request-connection', (data) => {
    const { renderServerId } = data;
    const renderServer = connections.renderServers.get(renderServerId);
    
    if (renderServer) {
      // 通知渲染服务器有客户端想要连接
      renderServer.socket.emit('client-connection-request', {
        clientId: socket.id,
        clientInfo: connections.clients.get(socket.id)?.info
      });
    } else {
      socket.emit('connection-error', { message: '渲染服务器不可用' });
    }
  });

  // WebRTC信令传递
  socket.on('webrtc-offer', (data) => {
    const { targetId, offer } = data;
    const target = connections.renderServers.get(targetId) || connections.clients.get(targetId);
    
    if (target) {
      target.socket.emit('webrtc-offer', {
        fromId: socket.id,
        offer
      });
    }
  });

  socket.on('webrtc-answer', (data) => {
    const { targetId, answer } = data;
    const target = connections.renderServers.get(targetId) || connections.clients.get(targetId);
    
    if (target) {
      target.socket.emit('webrtc-answer', {
        fromId: socket.id,
        answer
      });
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    const { targetId, candidate } = data;
    const target = connections.renderServers.get(targetId) || connections.clients.get(targetId);
    
    if (target) {
      target.socket.emit('webrtc-ice-candidate', {
        fromId: socket.id,
        candidate
      });
    }
  });

  // 用户交互事件转发
  socket.on('user-interaction', (data) => {
    const { targetId, interaction } = data;
    const target = connections.renderServers.get(targetId);
    
    if (target) {
      target.socket.emit('user-interaction', {
        fromId: socket.id,
        interaction
      });
    }
  });

  // 断开连接处理
  socket.on('disconnect', () => {
    console.log('连接断开:', socket.id);
    connections.renderServers.delete(socket.id);
    connections.clients.delete(socket.id);
    
    // 通知其他连接
    socket.broadcast.emit('peer-disconnected', { id: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`信令服务器运行在端口 ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 查看客户端界面`);
}); 