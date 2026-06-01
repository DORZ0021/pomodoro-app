const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// 保持全局引用，防止被垃圾回收
let mainWindow = null;
let tray = null;

// 数据存储路径
const userDataPath = app.getPath('userData');
const dataPath = path.join(userDataPath, 'pomodoro-data.json');

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 380,
    minHeight: 600,
    resizable: true,
    title: '番茄钟',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // 先隐藏，等 ready-to-show 再显示
    titleBarStyle: 'hiddenInset', // macOS 风格标题栏
  });

  mainWindow.loadFile('index.html');

  // 等页面加载完成再显示，避免白屏
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 窗口关闭时最小化到托盘，而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 创建系统托盘
function createTray() {
  // 使用一个简单的图标（如果没有自定义图标，会用默认的）
  let trayIcon;
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
    // 调整托盘图标大小
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } else {
    // 创建一个简单的空白图标作为后备
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('番茄钟');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: '隐藏',
      click: () => {
        if (mainWindow) mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 单击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// IPC 处理器

// 发送桌面通知
ipcMain.handle('send-notification', async (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title || '番茄钟',
      body: body || '时间到了！',
      icon: path.join(__dirname, 'assets', 'icon.png'),
      silent: false,
    });
    notification.show();
  }
});

// 保存数据到本地 JSON
ipcMain.handle('save-data', async (event, data) => {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    console.error('保存数据失败:', err);
    return { success: false, error: err.message };
  }
});

// 从本地 JSON 加载数据
ipcMain.handle('load-data', async () => {
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf-8');
      return JSON.parse(data);
    }
    // 返回默认数据结构
    return getDefaultData();
  } catch (err) {
    console.error('加载数据失败:', err);
    return getDefaultData();
  }
});

// 获取默认数据
function getDefaultData() {
  const today = new Date().toISOString().split('T')[0];
  return {
    settings: {
      workTime: 25,
      shortBreak: 5,
      longBreak: 15,
      longBreakInterval: 4,
      autoStart: false,
      soundEnabled: true,
      notificationEnabled: true,
    },
    tasks: [],
    history: [
      { date: today, completedPomodoros: 0, tasksCompleted: 0, totalFocusMinutes: 0 }
    ],
  };
}

// 应用启动
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// 所有窗口关闭时的行为（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 在 Windows/Linux 上保留托盘运行
    // 不调用 app.quit()，让应用在后台运行
  }
});

// 在退出前清理
app.on('before-quit', () => {
  app.isQuiting = true;
});
