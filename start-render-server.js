const puppeteer = require('puppeteer');
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const os = require('os');

class EnhancedRenderServer {
  constructor() {
    this.signalingServerUrl = process.env.SIGNALING_SERVER || 'http://localhost:3000';
    this.targetWebUrl = process.env.TARGET_URL || 'http://10.144.144.9:8080';
    this.socket = null;
    this.browser = null;
    this.page = null;
    this.clients = new Map();
    this.isCapturing = false;
    
    this.detectEnvironment();
    this.init();
  }

  detectEnvironment() {
    console.log('=== 环境检测 ===');
    console.log('操作系统:', os.platform());
    console.log('CPU架构:', os.arch());
    console.log('Node.js版本:', process.version);
    console.log('当前工作目录:', process.cwd());
    
    // 检测是否为无头环境
    const isHeadless = !process.env.DISPLAY && os.platform() === 'linux';
    console.log('无头环境:', isHeadless);
    
    // 设置环境变量
    if (isHeadless) {
      process.env.DISPLAY = ':99';
      console.log('设置虚拟显示: :99');
    }
  }

  async init() {
    try {
      console.log('=== 启动渲染服务器 ===');
      console.log('信令服务器:', this.signalingServerUrl);
      console.log('目标网页:', this.targetWebUrl);
      
      // 连接信令服务器
      await this.connectToSignalingServer();
      
      // 启动浏览器和页面捕获
      await this.setupBrowser();
      
      console.log('✅ 渲染服务器启动成功');
      console.log('等待客户端连接...');
    } catch (error) {
      console.error('❌ 渲染服务器启动失败:', error);
      process.exit(1);
    }
  }

  async connectToSignalingServer() {
    console.log('连接信令服务器...');
    
    this.socket = io(this.signalingServerUrl, {
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接信令服务器超时'));
      }, 15000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('✅ 已连接到信令服务器');
        
        // 注册为渲染服务器
        this.socket.emit('register-render-server', {
          name: '4090渲染服务器',
          capabilities: ['gpu-acceleration', 'high-fps'],
          targetUrl: this.targetWebUrl,
          platform: os.platform(),
          arch: os.arch()
        });
        
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`连接失败: ${error.message}`));
      });
    });
  }

  async setupBrowser() {
    console.log('启动浏览器...');
    
    // 动态生成Chrome启动参数
    const chromeArgs = [
      // 基础参数
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      
      // GPU加速（如果可用）
      '--enable-gpu',
      '--use-gl=desktop',
      '--enable-accelerated-2d-canvas',
      '--enable-accelerated-video-decode',
      '--enable-gpu-compositing',
      
      // 内存优化
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      
      // 性能优化
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run'
    ];

    // 检测Chrome路径
    let executablePath;
    if (os.platform() === 'linux') {
      const chromePaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ];
      
      for (const path of chromePaths) {
        try {
          if (fs.existsSync(path)) {
            executablePath = path;
            break;
          }
        } catch (error) {
          // 继续检查下一个路径
        }
      }
    }

    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: chromeArgs,
        ...(executablePath ? { executablePath } : {}),
        ignoreDefaultArgs: ['--disable-extensions'],
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false
      });

      console.log('✅ 浏览器启动成功');
      
      this.page = await this.browser.newPage();
      
      // 设置高分辨率
      await this.page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      });

      // 设置用户代理
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      console.log('正在加载目标网页:', this.targetWebUrl);
      
      // 分步骤加载页面
      await this.loadTargetPage();
      
    } catch (error) {
      console.error('浏览器启动失败:', error);
      throw error;
    }
  }

  async loadTargetPage() {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`尝试加载页面 (${attempt}/${maxRetries})...`);
        
        await this.page.goto(this.targetWebUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        console.log('✅ 页面加载成功');
        
        // 绑定事件处理
        this.setupEventHandlers();
        return;
        
      } catch (error) {
        console.warn(`页面加载失败 (尝试 ${attempt}):`, error.message);
        
        if (attempt === maxRetries) {
          // 最后一次尝试简单加载
          try {
            await this.page.goto(this.targetWebUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 15000
            });
            console.log('✅ 页面基本加载完成');
            this.setupEventHandlers();
            return;
          } catch (finalError) {
            throw new Error(`页面加载完全失败: ${finalError.message}`);
          }
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  setupEventHandlers() {
    // 客户端连接请求
    this.socket.on('client-connection-request', (data) => {
      console.log('收到客户端连接请求:', data);
      this.handleClientConnection(data.clientId);
    });

    // 用户交互
    this.socket.on('user-interaction', (data) => {
      this.handleUserInteraction(data);
    });

    // 画质调整
    this.socket.on('quality-change', (data) => {
      console.log('画质调整:', data.quality);
      // 可以根据画质调整截图参数
    });
  }

  async handleClientConnection(clientId) {
    try {
      console.log('✅ 客户端连接:', clientId);
      
      this.clients.set(clientId, {
        id: clientId,
        connected: true,
        lastActivity: Date.now()
      });

      // 发送连接确认
      this.socket.emit('connection-established', {
        clientId: clientId,
        serverInfo: {
          resolution: '1920x1080',
          fps: 20,
          platform: os.platform()
        }
      });

      // 开始视频捕获
      this.startVideoCapture(clientId);

    } catch (error) {
      console.error('处理客户端连接失败:', error);
    }
  }

  async startVideoCapture(clientId) {
    if (this.isCapturing) return;
    
    this.isCapturing = true;
    console.log('🎥 开始视频捕获');
    
    const captureAndSend = async () => {
      try {
        if (this.page && this.clients.has(clientId)) {
          const screenshot = await this.page.screenshot({
            type: 'jpeg',
            quality: 80,
            fullPage: false,
            optimizeForSpeed: true
          });

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
          break;
          
        case 'scroll':
          await this.page.mouse.wheel({
            deltaX: interaction.deltaX || 0,
            deltaY: interaction.deltaY || 0
          });
          break;
          
        case 'keypress':
          await this.page.keyboard.press(interaction.key);
          break;
          
        case 'type':
          await this.page.keyboard.type(interaction.text);
          break;
          
        case 'mousemove':
          await this.page.mouse.move(interaction.x, interaction.y);
          break;
      }
    } catch (error) {
      console.error('处理用户交互失败:', error);
    }
  }

  async cleanup() {
    console.log('🧹 清理资源...');
    
    this.isCapturing = false;
    
    if (this.browser) {
      await this.browser.close();
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    console.log('✅ 清理完成');
  }
}

// 处理进程退出
process.on('SIGINT', async () => {
  console.log('\n收到退出信号，正在清理...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('收到终止信号，正在清理...');
  process.exit(0);
});

// 启动服务器
console.log('🚀 启动增强型渲染服务器...');
const renderServer = new EnhancedRenderServer(); 