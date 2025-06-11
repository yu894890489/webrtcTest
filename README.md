# WebRTC远程渲染解决方案

这是一个基于WebRTC的远程渲染系统，解决了无显卡电脑访问GPU密集型web应用卡顿的问题。

## 系统架构

```
A机器 (Web服务) ←→ B机器 (4090渲染服务器) ←→ 信令服务器 ←→ C机器 (客户端)
```

- **A机器**: 部署web服务的机器
- **B机器**: 配备4090显卡的渲染服务器
- **C机器**: 无显卡的客户端机器
- **信令服务器**: 协调WebRTC连接

## 功能特性

- ✅ GPU加速渲染 (利用4090显卡)
- ✅ 低延迟视频传输 (WebRTC)
- ✅ 实时用户交互 (点击、滚动、键盘输入)
- ✅ 自适应画质控制
- ✅ 连接状态监控
- ✅ 多客户端支持

## 安装依赖

```bash
npm install
```

## 部署步骤

### 1. 启动信令服务器

在任意一台机器上运行（建议在B机器或独立服务器）：

```bash
npm start
```

信令服务器将在端口3000上运行。

### 2. 配置并启动渲染服务器（B机器 - 4090显卡）

设置环境变量：

```bash
# Windows
set SIGNALING_SERVER=http://信令服务器IP:3000
set TARGET_URL=http://A机器IP:A机器端口

# Linux/Mac
export SIGNALING_SERVER=http://信令服务器IP:3000
export TARGET_URL=http://A机器IP:A机器端口
```

启动渲染服务器：

```bash
npm run render-server
```

### 3. 客户端访问（C机器）

在浏览器中访问：
```
http://信令服务器IP:3000
```

## 配置说明

### 渲染服务器配置

在`render-server/index.js`中可以调整：

```javascript
// GPU加速选项
const browserArgs = [
  '--enable-gpu',
  '--use-gl=desktop',
  '--enable-accelerated-2d-canvas',
  // ... 更多GPU加速选项
];

// 视频捕获设置
const captureSettings = {
  fps: 30,          // 帧率
  quality: 85,      // JPEG质量 (0-100)
  chunkSize: 16384  // 数据块大小
};
```

### 客户端画质设置

客户端界面提供三档画质：
- **高画质**: 5 Mbps
- **中画质**: 2 Mbps (默认)
- **低画质**: 800 Kbps

## 网络要求

- **局域网**: 推荐千兆网络
- **延迟**: < 50ms为最佳体验
- **带宽**: 
  - 高画质: 5+ Mbps
  - 中画质: 2+ Mbps  
  - 低画质: 1+ Mbps

## 故障排除

### 常见问题

1. **渲染服务器无法启动**
   ```bash
   # 检查Chrome/Chromium是否正确安装
   node -e "console.log(require('puppeteer').executablePath())"
   
   # 如果使用Linux，可能需要安装依赖
   sudo apt-get install -y gconf-service libasound2-dev libatk1.0-dev libcairo-gobject2 libdrm2 libgtk-3-0 libgss3 libx11-xcb1 libxss1 libxtst6 fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
   ```

2. **WebRTC连接失败**
   - 检查防火墙设置
   - 确保STUN服务器可访问
   - 检查网络NAT配置

3. **GPU加速未生效**
   ```bash
   # 检查显卡驱动
   nvidia-smi
   
   # 确保Chrome可以访问GPU
   chrome://gpu/
   ```

4. **交互延迟过高**
   - 降低视频质量
   - 检查网络延迟
   - 优化浏览器参数

### 性能优化

1. **渲染服务器优化**
   ```javascript
   // 降低截图频率
   setTimeout(captureAndSend, 50); // 20 FPS
   
   // 调整JPEG质量
   quality: 70 // 降低质量以减少带宽
   ```

2. **网络优化**
   - 使用有线网络连接
   - 配置QoS优先级
   - 关闭其他网络密集型应用

## 安全考虑

- 建议在内网环境使用
- 生产环境需要添加认证机制
- 考虑使用HTTPS/WSS协议
- 限制渲染服务器访问权限

## 扩展功能

### 支持多显示器

```javascript
// 在setupBrowser中添加
await this.page.setViewport({
  width: 3840,  // 双4K显示器
  height: 1080
});
```

### 添加音频支持

```javascript
// 在WebRTC配置中启用音频
const offer = await peerConnection.createOffer({
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
});
```

### 录制功能

```javascript
// 添加视频录制
const recorder = new MediaRecorder(stream);
recorder.start();
```

## 开发模式

```bash
# 使用nodemon进行开发
npm run dev

# 调试模式启动渲染服务器
DEBUG=* npm run render-server
```

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Node.js, Express, Socket.IO
- **WebRTC**: RTCPeerConnection, DataChannel
- **浏览器自动化**: Puppeteer
- **图像处理**: Canvas API, JPEG编码

## 许可证

MIT License

## 贡献

欢迎提交Issues和Pull Requests！

## 联系方式

如有问题请提交Issue或联系开发团队。 