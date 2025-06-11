class WebRTCClient {
    constructor() {
        this.socket = null;
        this.serverUrl = 'http://localhost:3000';
        this.currentServer = null;
        this.videoElement = null;
        this.stats = {
            fps: 0,
            frameCount: 0,
            lastFrameTime: 0,
            bytesReceived: 0
        };
        
        this.init();
    }

    init() {
        // 获取UI元素
        this.videoElement = document.getElementById('videoStream');
        
        // 绑定事件
        this.bindEvents();
        
        // 连接到信令服务器
        this.connectToServer();
        
        // 开始统计
        this.startStatsMonitoring();
    }

    bindEvents() {
        // 服务器选择
        document.getElementById('serverSelect').addEventListener('change', (e) => {
            this.selectServer(e.target.value);
        });

        // 连接按钮
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connectToRenderServer();
        });

        // 断开连接按钮
        document.getElementById('disconnectBtn').addEventListener('click', () => {
            this.disconnect();
        });
        
        // 视频交互事件
        if (this.videoElement) {
            // 鼠标事件
            this.videoElement.addEventListener('click', (e) => {
                this.sendInteraction('click', this.getRelativeCoordinates(e));
            });
            
            this.videoElement.addEventListener('mousemove', (e) => {
                this.sendInteraction('mousemove', this.getRelativeCoordinates(e));
            });
            
            // 滚轮事件
            this.videoElement.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.sendInteraction('scroll', {
                    deltaX: e.deltaX,
                    deltaY: e.deltaY
                });
            });
        }
        
        // 键盘事件（全局）
        document.addEventListener('keydown', (e) => {
            if (this.isConnected()) {
                this.sendInteraction('keypress', { key: e.key });
            }
        });
        
        // 画质控制
        document.getElementById('qualitySelect').addEventListener('change', (e) => {
            this.updateQuality(e.target.value);
        });
        
        // 全屏切换
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            this.toggleFullscreen();
        });
    }

    connectToServer() {
        this.socket = io(this.serverUrl);

        this.socket.on('connect', () => {
            console.log('已连接到信令服务器');
            this.updateConnectionStatus('已连接到信令服务器', 'connected');
            this.requestAvailableServers();
        });

        this.socket.on('disconnect', () => {
            console.log('与信令服务器断开连接');
            this.updateConnectionStatus('与服务器断开连接', 'disconnected');
        });

        this.socket.on('available-servers', (servers) => {
            this.updateServerList(servers);
        });

        this.socket.on('video-frame', (data) => {
            this.handleVideoFrame(data);
        });

        this.socket.on('connection-established', (data) => {
            console.log('连接已建立:', data);
            this.updateConnectionStatus('连接已建立', 'streaming');
            document.getElementById('disconnectBtn').style.display = 'inline-block';
        });

        this.socket.on('error', (error) => {
            console.error('Socket错误:', error);
            this.updateConnectionStatus('连接错误: ' + error, 'error');
        });
    }

    requestAvailableServers() {
        this.socket.emit('get-available-servers');
    }

    updateServerList(servers) {
        const select = document.getElementById('serverSelect');
        select.innerHTML = '<option value="">选择渲染服务器...</option>';
        
        servers.forEach(server => {
            const option = document.createElement('option');
            option.value = server.id;
            option.textContent = `${server.name} (${server.capabilities.join(', ')})`;
            select.appendChild(option);
        });
        
        if (servers.length > 0) {
            document.getElementById('connectBtn').disabled = false;
        }
    }

    selectServer(serverId) {
        this.currentServer = serverId;
        document.getElementById('connectBtn').disabled = !serverId;
    }

    connectToRenderServer() {
        if (!this.currentServer) {
            alert('请先选择一个渲染服务器');
            return;
        }

        console.log('连接到渲染服务器:', this.currentServer);
        this.updateConnectionStatus('正在连接...', 'connecting');
        
        this.socket.emit('connect-to-render-server', {
            serverId: this.currentServer
        });
    }

    handleVideoFrame(data) {
        try {
            // 更新统计
            this.updateStats(data.frame.length);
            
            // 显示截图
            if (this.videoElement) {
                this.videoElement.src = 'data:image/jpeg;base64,' + data.frame;
                this.videoElement.style.display = 'block';
            }
            
        } catch (error) {
            console.error('处理视频帧失败:', error);
        }
    }

    getRelativeCoordinates(event) {
        const rect = this.videoElement.getBoundingClientRect();
        const scaleX = 1920 / rect.width;  // 假设渲染分辨率为1920x1080
        const scaleY = 1080 / rect.height;
        
        return {
            x: Math.round((event.clientX - rect.left) * scaleX),
            y: Math.round((event.clientY - rect.top) * scaleY)
        };
    }

    sendInteraction(type, data) {
        if (this.socket && this.currentServer) {
            this.socket.emit('user-interaction', {
                interaction: {
                    type: type,
                    ...data
                }
            });
        }
    }

    updateQuality(quality) {
        if (this.socket) {
            this.socket.emit('quality-change', {
                quality: quality
            });
        }
    }

    toggleFullscreen() {
        const container = document.getElementById('videoContainer');
        
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.error('进入全屏失败:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.emit('disconnect-from-render-server');
        }
        
        this.updateConnectionStatus('已断开连接', 'disconnected');
        document.getElementById('disconnectBtn').style.display = 'none';
        
        if (this.videoElement) {
            this.videoElement.style.display = 'none';
        }
    }

    isConnected() {
        return this.socket && this.socket.connected && this.currentServer;
    }

    updateConnectionStatus(message, status) {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.textContent = message;
        statusEl.className = `status ${status}`;
    }

    updateStats(frameSize) {
        this.stats.frameCount++;
        this.stats.bytesReceived += frameSize;
        
        const now = Date.now();
        if (now - this.stats.lastFrameTime >= 1000) {
            this.stats.fps = this.stats.frameCount;
            this.stats.frameCount = 0;
            this.stats.lastFrameTime = now;
            
            // 更新UI显示
            const statsEl = document.getElementById('performanceStats');
            if (statsEl) {
                const mbReceived = (this.stats.bytesReceived / 1024 / 1024).toFixed(2);
                statsEl.innerHTML = `
                    <div>帧率: ${this.stats.fps} FPS</div>
                    <div>数据接收: ${mbReceived} MB</div>
                `;
            }
        }
    }

    startStatsMonitoring() {
        setInterval(() => {
            if (this.isConnected()) {
                // 可以添加延迟测试等
            }
        }, 5000);
    }
}

// 页面加载完成后启动客户端
document.addEventListener('DOMContentLoaded', () => {
    window.webrtcClient = new WebRTCClient();
}); 