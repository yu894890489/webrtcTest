const puppeteer = require('puppeteer');
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

class RenderServer {
  constructor(signalingServerUrl, targetWebUrl) {
    this.signalingServerUrl = signalingServerUrl;
    this.targetWebUrl = targetWebUrl;
    this.socket = null;
    this.browser = null;
    this.page = null;
    this.clients = new Map();
    this.isCapturing = false;
    
    this.init();
  }

  async init() {
    try {
      // 连接信令服务器
      await this.connectToSignalingServer();
      
      // 启动浏览器和页面捕获
      await this.setupBrowser();
      
      console.log('渲染服务器启动成功');
    } catch (error) {
      console.error('渲染服务器启动失败:', error);
    }
  }

  async connectToSignalingServer() {
    this.socket = io(this.signalingServerUrl);

    this.socket.on('connect', () => {
      console.log('已连接到信令服务器');
      
      // 注册为渲染服务器
      this.socket.emit('register-render-server', {
        name: '4090渲染服务器',
        capabilities: ['gpu-acceleration', 'high-fps'],
        targetUrl: this.targetWebUrl
      });
    });

    this.socket.on('client-connection-request', (data) => {
      console.log('收到客户端连接请求:', data);
      this.handleClientConnection(data.clientId);
    });

    this.socket.on('user-interaction', (data) => {
      this.handleUserInteraction(data);
    });
  }

  async setupBrowser() {
    // 启动Puppeteer，适配无GUI环境
    this.browser = await puppeteer.launch({
      headless: 'new', // 使用新版headless模式
      args: [
        // 基础GPU加速参数
        '--enable-gpu',
        '--use-gl=desktop',
        '--enable-accelerated-2d-canvas',
        '--enable-accelerated-jpeg-decoding',
        '--enable-accelerated-mjpeg-decode',
        '--enable-accelerated-video',
        '--enable-gpu-compositing',
        '--enable-gpu-memory-buffer-video-frames',
        '--enable-native-gpu-memory-buffers',
        '--num-raster-threads=4',
        '--enable-zero-copy',
        
        // 无显示环境兼容参数
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        
        // 虚拟显示参数
        '--virtual-time-budget=5000',
        '--run-all-compositor-stages-before-draw',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--disable-prompt-on-repost',
        '--disable-hang-monitor',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability'
      ],
      
      // 如果是Linux环境，可能需要指定executablePath
      ...(process.platform === 'linux' ? {
        executablePath: '/usr/bin/google-chrome-stable'
      } : {})
    });

    this.page = await this.browser.newPage();
    
    // 设置高分辨率
    await this.page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    });

    // 设置用户代理
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('正在加载目标网页...');
    
    try {
      // 加载目标网页
      await this.page.goto(this.targetWebUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      console.log('浏览器页面加载完成');
    } catch (error) {
      console.warn('页面加载超时或失败，尝试基本加载...', error.message);
      
      // 如果完整加载失败，尝试基本加载
      await this.page.goto(this.targetWebUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      
      console.log('页面基本加载完成');
    }
  }

  async handleClientConnection(clientId) {
    try {
      console.log('处理客户端连接:', clientId);
      
      // 存储客户端信息
      this.clients.set(clientId, {
        id: clientId,
        connected: true,
        lastActivity: Date.now()
      });

      // 开始定期发送截图
      this.startVideoCapture(clientId);

      console.log('客户端连接成功:', clientId);
    } catch (error) {
      console.error('处理客户端连接失败:', error);
    }
  }

  async startVideoCapture(clientId) {
    if (this.isCapturing) return;
    
    this.isCapturing = true;
    console.log('开始视频捕获');
    
    const captureAndSend = async () => {
      try {
        if (this.page && this.clients.has(clientId)) {
          // 截取页面截图
          const screenshot = await this.page.screenshot({
            type: 'jpeg',
            quality: 85,
            fullPage: false
          });

          // 通过Socket.IO发送截图数据
          const base64Data = screenshot.toString('base64');
          
          this.socket.emit('video-frame', {
            targetId: clientId,
            frame: base64Data,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('截图失败:', error);
      }
      
      // 20 FPS (50ms间隔)
      if (this.isCapturing && this.clients.size > 0) {
        setTimeout(captureAndSend, 50);
      } else {
        this.isCapturing = false;
      }
    };

    captureAndSend();
  }

  async handleUserInteraction(data) {
    const { interaction } = data;
    
    try {
      switch (interaction.type) {
        case 'click':
          await this.page.mouse.click(interaction.x, interaction.y);
          console.log(`点击: (${interaction.x}, ${interaction.y})`);
          break;
          
        case 'scroll':
          await this.page.mouse.wheel({
            deltaX: interaction.deltaX || 0,
            deltaY: interaction.deltaY || 0
          });
          console.log(`滚动: (${interaction.deltaX}, ${interaction.deltaY})`);
          break;
          
        case 'keypress':
          await this.page.keyboard.press(interaction.key);
          console.log(`按键: ${interaction.key}`);
          break;
          
        case 'type':
          await this.page.keyboard.type(interaction.text);
          console.log(`输入: ${interaction.text}`);
          break;
          
        case 'mousemove':
          await this.page.mouse.move(interaction.x, interaction.y);
          break;
          
        default:
          console.log('未知交互类型:', interaction.type);
      }
    } catch (error) {
      console.error('处理用户交互失败:', error);
    }
  }

  async cleanup() {
    this.isCapturing = false;
    
    if (this.browser) {
      await this.browser.close();
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    console.log('渲染服务器已清理');
  }
}

// 处理进程退出
process.on('SIGINT', async () => {
  console.log('收到退出信号，正在清理...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('收到终止信号，正在清理...');
  process.exit(0);
});

// 启动渲染服务器
const signalingServerUrl = process.env.SIGNALING_SERVER || 'http://localhost:3000';
const targetWebUrl = process.env.TARGET_URL || 'http://192.168.1.100:8080'; // 替换为实际的A机器地址

console.log('启动渲染服务器...');
console.log('信令服务器:', signalingServerUrl);
console.log('目标网页:', targetWebUrl);
console.log('请确保：');
console.log('1. A机器的web服务正在运行');
console.log('2. 当前机器（B机器）有4090显卡');
console.log('3. 信令服务器已启动');

const renderServer = new RenderServer(signalingServerUrl, targetWebUrl); 