const { contextBridge, ipcRenderer } = require('electron');

// 安全地将 Electron API 暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 发送桌面通知
  sendNotification: (title, body) => ipcRenderer.invoke('send-notification', { title, body }),

  // 数据持久化
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),
});
