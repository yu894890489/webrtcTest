#!/bin/bash

echo "=== Chrome浏览器环境检测和安装脚本 ==="

# 检测操作系统
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "检测到Linux系统"
    
    # 检测发行版
    if [ -f /etc/debian_version ]; then
        echo "检测到Debian/Ubuntu系统"
        
        # 更新包列表
        sudo apt-get update
        
        # 安装依赖
        sudo apt-get install -y \
            ca-certificates \
            fonts-liberation \
            libappindicator3-1 \
            libasound2 \
            libatk-bridge2.0-0 \
            libatk1.0-0 \
            libc6 \
            libcairo2 \
            libcups2 \
            libdbus-1-3 \
            libexpat1 \
            libfontconfig1 \
            libgbm1 \
            libgcc1 \
            libglib2.0-0 \
            libgtk-3-0 \
            libnspr4 \
            libnss3 \
            libpango-1.0-0 \
            libpangocairo-1.0-0 \
            libstdc++6 \
            libx11-6 \
            libx11-xcb1 \
            libxcb1 \
            libxcomposite1 \
            libxcursor1 \
            libxdamage1 \
            libxext6 \
            libxfixes3 \
            libxi6 \
            libxrandr2 \
            libxrender1 \
            libxss1 \
            libxtst6 \
            lsb-release \
            wget \
            xdg-utils \
            xvfb
            
        # 安装Chrome
        if ! command -v google-chrome-stable &> /dev/null; then
            echo "安装Google Chrome..."
            wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
            echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
            sudo apt-get update
            sudo apt-get install -y google-chrome-stable
        else
            echo "Google Chrome已安装"
        fi
        
    elif [ -f /etc/redhat-release ]; then
        echo "检测到RedHat/CentOS系统"
        
        # 安装依赖
        sudo yum install -y \
            alsa-lib \
            atk \
            cups-libs \
            gtk3 \
            ipa-gothic-fonts \
            libXcomposite \
            libXcursor \
            libXdamage \
            libXext \
            libXi \
            libXrandr \
            libXScrnSaver \
            libXtst \
            pango \
            xorg-x11-fonts-100dpi \
            xorg-x11-fonts-75dpi \
            xorg-x11-fonts-cyrillic \
            xorg-x11-fonts-misc \
            xorg-x11-fonts-Type1 \
            xorg-x11-utils \
            xvfb
            
        # 安装Chrome
        if ! command -v google-chrome-stable &> /dev/null; then
            echo "安装Google Chrome..."
            sudo yum install -y https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
        else
            echo "Google Chrome已安装"
        fi
        
    else
        echo "未识别的Linux发行版，请手动安装Chrome浏览器"
        exit 1
    fi
    
    echo "Chrome安装完成"
    google-chrome-stable --version
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "检测到macOS系统"
    echo "请从 https://www.google.com/chrome/ 下载安装Chrome"
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo "检测到Windows系统"
    echo "Puppeteer将使用系统已安装的Chrome或自动下载Chromium"
    
else
    echo "未识别的操作系统: $OSTYPE"
    exit 1
fi

echo "=== 环境检测完成 ===" 