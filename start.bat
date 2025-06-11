@echo off
echo ==========================================
echo WebRTC远程渲染系统启动脚本
echo ==========================================
echo.

:menu
echo 请选择要启动的服务：
echo 1. 启动信令服务器
echo 2. 启动渲染服务器（需要4090显卡）
echo 3. 查看客户端地址
echo 4. 全部启动（推荐）
echo 5. 退出
echo.
set /p choice=请输入选择 (1-5): 

if "%choice%"=="1" goto signaling
if "%choice%"=="2" goto render
if "%choice%"=="3" goto client
if "%choice%"=="4" goto all
if "%choice%"=="5" goto exit
goto menu

:signaling
echo.
echo 启动信令服务器...
npm start
goto menu

:render
echo.
echo 请设置目标网页地址（A机器的web服务）
set /p target_url=请输入A机器地址 (例: http://192.168.1.100:8080): 
if "%target_url%"=="" set target_url=http://192.168.1.100:8080

echo 请设置信令服务器地址
set /p signaling_url=请输入信令服务器地址 (例: http://localhost:3000): 
if "%signaling_url%"=="" set signaling_url=http://localhost:3000

set TARGET_URL=%target_url%
set SIGNALING_SERVER=%signaling_url%

echo.
echo 配置信息：
echo 目标网页: %TARGET_URL%
echo 信令服务器: %SIGNALING_SERVER%
echo.
echo 启动渲染服务器...
npm run render-server
goto menu

:client
echo.
echo ==========================================
echo 客户端访问信息
echo ==========================================
echo.
echo 请在C机器（客户端）的浏览器中访问：
echo http://信令服务器IP:3000
echo.
echo 例如：
echo http://localhost:3000          (如果信令服务器在本机)
echo http://192.168.1.xxx:3000     (如果信令服务器在其他机器)
echo.
echo 注意：请将上面的IP地址替换为实际的信令服务器IP
echo ==========================================
pause
goto menu

:all
echo.
echo 全部启动模式 - 将同时启动信令服务器和渲染服务器
echo.

echo 请设置目标网页地址（A机器的web服务）
set /p target_url=请输入A机器地址 (例: http://192.168.1.100:8080): 
if "%target_url%"=="" set target_url=http://192.168.1.100:8080

set TARGET_URL=%target_url%
set SIGNALING_SERVER=http://localhost:3000

echo.
echo 配置信息：
echo 目标网页: %TARGET_URL%
echo 信令服务器: %SIGNALING_SERVER%
echo.

echo 正在启动信令服务器...
start "信令服务器" cmd /k "echo 信令服务器启动中... && npm start"

echo 等待信令服务器启动...
timeout /t 5 /nobreak >nul

echo 正在启动渲染服务器...
start "渲染服务器" cmd /k "echo 渲染服务器启动中... && npm run render-server"

echo.
echo ==========================================
echo 所有服务已启动！
echo ==========================================
echo.
echo 客户端访问地址: http://localhost:3000
echo.
echo 如果需要从其他机器访问，请使用：
echo http://本机IP:3000
echo.
echo 按任意键返回主菜单...
pause >nul
goto menu

:exit
echo.
echo 感谢使用！
exit

:error
echo.
echo 发生错误，请检查：
echo 1. 是否已安装 Node.js
echo 2. 是否已运行 npm install
echo 3. 网络连接是否正常
echo.
pause
goto menu 