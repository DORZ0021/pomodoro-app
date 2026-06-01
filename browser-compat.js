/**
 * 浏览器兼容层 — 让应用在浏览器中也能运行
 * 当 Electron 不可用时，使用 localStorage + Web Notification API 替代
 */
(function () {
  // 如果已经有 electronAPI，说明在 Electron 中运行，跳过
  if (window.electronAPI) return;

  const STORAGE_KEY = 'pomodoro-data';

  window.electronAPI = {
    // 使用 Web Notification API 替代 Electron Notification
    sendNotification: async (title, body) => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '' });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body, icon: '' });
        }
      }
    },

    // 使用 localStorage 替代文件存储
    saveData: async (data) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return { success: true };
      } catch (err) {
        console.error('保存数据失败:', err);
        return { success: false, error: err.message };
      }
    },

    loadData: async () => {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          return JSON.parse(data);
        }
        return null;
      } catch (err) {
        console.error('加载数据失败:', err);
        return null;
      }
    },
  };

  // 请求通知权限
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  console.log('[BrowserCompat] 运行在浏览器模式，使用 localStorage 和 Web Notification');
})();
