/**
 * 渲染进程主逻辑
 * 负责 UI 更新、用户交互、数据管理
 */

// ===== 全局状态 =====
let appData = null;
let timer = null;
let currentView = 'timer';
let currentTheme = 'work'; // 当前主题色

// ===== DOM 元素缓存 =====
const els = {};

function cacheElements() {
  // 计时器
  els.timerDisplay = document.getElementById('timerDisplay');
  els.modeLabel = document.getElementById('modeLabel');
  els.pomodoroCount = document.getElementById('pomodoroCount');
  els.progressCircle = document.getElementById('progressCircle');
  els.toggleBtn = document.getElementById('toggleBtn');
  els.toggleBtnText = document.getElementById('toggleBtnText');
  els.resetBtn = document.getElementById('resetBtn');
  els.skipBtn = document.getElementById('skipBtn');
  els.modeTabs = document.getElementById('modeTabs');

  // 窗口控制
  els.closeBtn = document.getElementById('closeBtn');
  els.minimizeBtn = document.getElementById('minimizeBtn');
  els.titleText = document.getElementById('titleText');

  // 导航
  els.navItems = document.querySelectorAll('.nav-item');
  els.views = document.querySelectorAll('.view');

  // 任务
  els.taskInput = document.getElementById('taskInput');
  els.addTaskBtn = document.getElementById('addTaskBtn');
  els.taskList = document.getElementById('taskList');
  els.taskEmptyState = document.getElementById('taskEmptyState');

  // 统计
  els.statToday = document.getElementById('statToday');
  els.statWeek = document.getElementById('statWeek');
  els.statFocusTime = document.getElementById('statFocusTime');
  els.statTasks = document.getElementById('statTasks');
  els.weeklyChart = document.getElementById('weeklyChart');

  // 设置
  els.settingWorkTime = document.getElementById('settingWorkTime');
  els.settingShortBreak = document.getElementById('settingShortBreak');
  els.settingLongBreak = document.getElementById('settingLongBreak');
  els.settingLongInterval = document.getElementById('settingLongInterval');
  els.toggleAutoStart = document.getElementById('toggleAutoStart');
  els.toggleSound = document.getElementById('toggleSound');
  els.toggleNotification = document.getElementById('toggleNotification');
}

// ===== 初始化 =====
async function init() {
  cacheElements();
  await loadData();
  initTimer();
  bindEvents();
  renderTasks();
  updateStats();
  applyTheme('work');
}

// ===== 数据加载与保存 =====
async function loadData() {
  try {
    appData = await window.electronAPI.loadData();
  } catch (e) {
    console.error('加载数据失败:', e);
    appData = getDefaultData();
  }

  // 确保今天的历史记录存在
  const today = getTodayString();
  if (!appData.history) appData.history = [];
  const todayRecord = appData.history.find(h => h.date === today);
  if (!todayRecord) {
    appData.history.push({
      date: today,
      completedPomodoros: 0,
      tasksCompleted: 0,
      totalFocusMinutes: 0,
    });
  }

  // 确保 tasks 存在
  if (!appData.tasks) appData.tasks = [];
  // 确保 settings 存在
  if (!appData.settings) appData.settings = getDefaultData().settings;
}

async function saveData() {
  try {
    await window.electronAPI.saveData(appData);
  } catch (e) {
    console.error('保存数据失败:', e);
  }
}

function getDefaultData() {
  const today = getTodayString();
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
    history: [{
      date: today,
      completedPomodoros: 0,
      tasksCompleted: 0,
      totalFocusMinutes: 0,
    }],
  };
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getTodayRecord() {
  const today = getTodayString();
  return appData.history.find(h => h.date === today);
}

// ===== 计时器初始化 =====
function initTimer() {
  timer = new PomodoroTimer({
    workTime: appData.settings.workTime,
    shortBreak: appData.settings.shortBreak,
    longBreak: appData.settings.longBreak,
    longBreakInterval: appData.settings.longBreakInterval,
    autoStart: appData.settings.autoStart,
    onTick: onTimerTick,
    onComplete: onTimerComplete,
    onModeChange: onModeChange,
  });

  // 初始化显示
  els.timerDisplay.textContent = PomodoroTimer.formatTime(timer.timeLeft);
  els.modeLabel.textContent = timer.getModeName();
  updatePomodoroCountDisplay();
}

function onTimerTick(timeLeft) {
  els.timerDisplay.textContent = PomodoroTimer.formatTime(timeLeft);
  updateProgressCircle();
  updateTitle(timeLeft);
}

function onTimerComplete(mode) {
  // 播放音效
  if (appData.settings.soundEnabled) {
    playNotificationSound();
  }

  // 发送桌面通知
  if (appData.settings.notificationEnabled) {
    const title = mode === 'work' ? '专注完成！' : '休息结束！';
    const body = mode === 'work' ? '恭喜你完成一个番茄，休息一下吧。' : '休息结束，准备开始新的专注吧！';
    window.electronAPI.sendNotification(title, body);
  }

  // 如果是工作模式完成，更新统计数据
  if (mode === 'work') {
    const record = getTodayRecord();
    if (record) {
      record.completedPomodoros += 1;
      record.totalFocusMinutes += appData.settings.workTime;
      saveData();
    }
    updatePomodoroCountDisplay();
    updateStats();
  }

  // 更新按钮状态
  updateToggleButton();
}

function onModeChange(mode) {
  els.modeLabel.textContent = timer.getModeName();
  updateToggleButton();
  applyTheme(mode);
  updateModeTabs();
}

// ===== UI 更新 =====

// 更新圆形进度条
function updateProgressCircle() {
  const radius = 90;
  const circumference = 2 * Math.PI * radius; // ~565.48
  const progress = timer.getProgress();
  const offset = circumference * (1 - progress);
  els.progressCircle.style.strokeDashoffset = offset;
}

// 更新窗口标题（显示剩余时间）
function updateTitle(timeLeft) {
  const timeStr = PomodoroTimer.formatTime(timeLeft);
  els.titleText.textContent = `${timeStr} - ${timer.getModeName()}`;
}

// 更新今日番茄数显示
function updatePomodoroCountDisplay() {
  const record = getTodayRecord();
  const count = record ? record.completedPomodoros : 0;
  els.pomodoroCount.textContent = `今日番茄: ${count}`;
}

// 更新开始/暂停按钮
function updateToggleButton() {
  if (timer.isRunning) {
    els.toggleBtnText.textContent = '暂停';
  } else {
    els.toggleBtnText.textContent = timer.timeLeft === timer.getCurrentDuration() * 60 ? '开始' : '继续';
  }
}

// 应用主题色
function applyTheme(mode) {
  currentTheme = mode;
  const colors = {
    work: { primary: 'work', color: '#FF6B6B' },
    shortBreak: { primary: 'short', color: '#4ECDC4' },
    longBreak: { primary: 'long', color: '#45B7D1' },
  };

  const theme = colors[mode] || colors.work;

  // 更新进度条颜色
  els.progressCircle.className = `timer-circle-progress ${theme.primary}`;

  // 更新主按钮颜色
  els.toggleBtn.className = `btn btn-primary ${theme.primary}`;

  // 更新激活的标签页颜色
  els.navItems.forEach(nav => {
    nav.classList.remove('active', 'short', 'long');
    if (nav.classList.contains('active')) {
      nav.classList.add('active', theme.primary);
    }
  });

  // 更新标签页激活状态
  updateModeTabs();
}

function updateModeTabs() {
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.classList.remove('active', 'short', 'long');
    if (tab.dataset.mode === timer.currentMode) {
      tab.classList.add('active');
      if (timer.currentMode === 'shortBreak') tab.classList.add('short');
      if (timer.currentMode === 'longBreak') tab.classList.add('long');
    }
  });
}

// ===== 音效 =====
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.2);

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.error('播放音效失败:', e);
  }
}

// ===== 视图切换 =====
function switchView(viewName) {
  currentView = viewName;

  // 更新导航
  els.navItems.forEach(nav => {
    nav.classList.remove('active', 'short', 'long');
    if (nav.dataset.view === viewName) {
      nav.classList.add('active');
      nav.classList.add(currentTheme === 'work' ? '' : currentTheme);
    }
  });

  // 更新视图
  els.views.forEach(view => view.classList.remove('active'));
  document.getElementById(viewName + 'View').classList.add('active');

  // 如果切换到统计页，刷新数据
  if (viewName === 'stats') {
    updateStats();
  }
  // 如果切换到设置页，同步设置值
  if (viewName === 'settings') {
    syncSettingsUI();
  }
}

// ===== 任务管理 =====
function renderTasks() {
  const tasks = appData.tasks || [];
  els.taskList.innerHTML = '';

  if (tasks.length === 0) {
    els.taskEmptyState.style.display = 'block';
    return;
  }
  els.taskEmptyState.style.display = 'none';

  tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'task-item';
    item.innerHTML = `
      <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}"></div>
      <div class="task-text ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</div>
      <div class="task-pomodoros">🍅 ${task.pomodoros || 0}</div>
      <button class="task-delete" data-id="${task.id}">×</button>
    `;
    els.taskList.appendChild(item);
  });

  // 绑定任务项事件
  document.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('click', () => toggleTask(parseInt(cb.dataset.id)));
  });
  document.querySelectorAll('.task-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(parseInt(btn.dataset.id)));
  });
}

function addTask() {
  const title = els.taskInput.value.trim();
  if (!title) return;

  const newTask = {
    id: Date.now(),
    title,
    completed: false,
    pomodoros: 0,
  };

  appData.tasks.push(newTask);
  els.taskInput.value = '';
  saveData();
  renderTasks();
}

function toggleTask(id) {
  const task = appData.tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;

  // 如果完成任务，更新今日统计
  if (task.completed) {
    const record = getTodayRecord();
    if (record) {
      record.tasksCompleted += 1;
      saveData();
    }
  } else {
    // 取消完成，减回统计
    const record = getTodayRecord();
    if (record && record.tasksCompleted > 0) {
      record.tasksCompleted -= 1;
      saveData();
    }
  }

  saveData();
  renderTasks();
  updateStats();
}

function deleteTask(id) {
  appData.tasks = appData.tasks.filter(t => t.id !== id);
  saveData();
  renderTasks();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== 统计 =====
function updateStats() {
  const today = getTodayString();
  const todayRecord = getTodayRecord() || { completedPomodoros: 0, tasksCompleted: 0, totalFocusMinutes: 0 };

  // 计算本周数据
  const weekDates = getLastNDates(7);
  let weekTotal = 0;
  weekDates.forEach(date => {
    const record = appData.history.find(h => h.date === date);
    if (record) weekTotal += record.completedPomodoros;
  });

  els.statToday.textContent = todayRecord.completedPomodoros;
  els.statWeek.textContent = weekTotal;
  els.statFocusTime.textContent = Math.round(todayRecord.totalFocusMinutes / 60 * 10) / 10 + 'h';
  els.statTasks.textContent = todayRecord.tasksCompleted;

  // 绘制近7天柱状图
  renderWeeklyChart(weekDates);
}

function getLastNDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function renderWeeklyChart(dates) {
  const values = dates.map(date => {
    const record = appData.history.find(h => h.date === date);
    return record ? record.completedPomodoros : 0;
  });

  const maxVal = Math.max(...values, 1);

  els.weeklyChart.innerHTML = '';
  dates.forEach((date, i) => {
    const val = values[i];
    const dayLabel = new Date(date).toLocaleDateString('zh-CN', { weekday: 'short' });
    const heightPercent = (val / maxVal) * 100;

    const wrapper = document.createElement('div');
    wrapper.className = 'chart-bar-wrapper';
    wrapper.innerHTML = `
      <div class="chart-bar" style="height: ${Math.max(heightPercent, 4)}%"></div>
      <div class="chart-bar-label">${dayLabel}</div>
    `;
    els.weeklyChart.appendChild(wrapper);
  });
}

// ===== 设置 =====
function syncSettingsUI() {
  const s = appData.settings;
  els.settingWorkTime.value = s.workTime;
  els.settingShortBreak.value = s.shortBreak;
  els.settingLongBreak.value = s.longBreak;
  els.settingLongInterval.value = s.longBreakInterval;
  setToggleState(els.toggleAutoStart, s.autoStart);
  setToggleState(els.toggleSound, s.soundEnabled);
  setToggleState(els.toggleNotification, s.notificationEnabled);
}

function setToggleState(el, isOn) {
  if (isOn) {
    el.classList.add('on');
  } else {
    el.classList.remove('on');
  }
}

function toggleSwitch(el) {
  const isOn = el.classList.toggle('on');
  return isOn;
}

function saveSettings() {
  const s = appData.settings;
  s.workTime = parseInt(els.settingWorkTime.value) || 25;
  s.shortBreak = parseInt(els.settingShortBreak.value) || 5;
  s.longBreak = parseInt(els.settingLongBreak.value) || 15;
  s.longBreakInterval = parseInt(els.settingLongInterval.value) || 4;

  // 限制范围
  s.workTime = Math.max(1, Math.min(60, s.workTime));
  s.shortBreak = Math.max(1, Math.min(30, s.shortBreak));
  s.longBreak = Math.max(1, Math.min(60, s.longBreak));
  s.longBreakInterval = Math.max(2, Math.min(10, s.longBreakInterval));

  // 同步到计时器
  timer.updateSettings({
    workTime: s.workTime,
    shortBreak: s.shortBreak,
    longBreak: s.longBreak,
    longBreakInterval: s.longBreakInterval,
    autoStart: s.autoStart,
  });

  // 如果计时器未运行，更新显示
  if (!timer.isRunning) {
    els.timerDisplay.textContent = PomodoroTimer.formatTime(timer.timeLeft);
    updateProgressCircle();
  }

  saveData();
}

// ===== 事件绑定 =====
function bindEvents() {
  // 计时器控制
  els.toggleBtn.addEventListener('click', () => {
    if (timer.isRunning) {
      timer.pause();
    } else {
      timer.start();
    }
    updateToggleButton();
  });

  els.resetBtn.addEventListener('click', () => {
    timer.reset();
    updateToggleButton();
    updateProgressCircle();
  });

  els.skipBtn.addEventListener('click', () => {
    timer.skip();
    updateToggleButton();
    updateProgressCircle();
  });

  // 模式切换标签
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      timer.setMode(mode);
      updateToggleButton();
      updateProgressCircle();
    });
  });

  // 窗口控制
  els.closeBtn.addEventListener('click', () => {
    window.electronAPI?.closeWindow?.();
    // 如果没有定义，最小化到托盘
  });
  els.minimizeBtn.addEventListener('click', () => {
    // 在 Electron 中，隐藏窗口即可最小化到托盘
  });

  // 底部导航
  els.navItems.forEach(nav => {
    nav.addEventListener('click', () => switchView(nav.dataset.view));
  });

  // 任务
  els.addTaskBtn.addEventListener('click', addTask);
  els.taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });

  // 设置 - 数值输入实时保存
  [els.settingWorkTime, els.settingShortBreak, els.settingLongBreak, els.settingLongInterval].forEach(input => {
    input.addEventListener('change', saveSettings);
  });

  // 设置 - 开关
  els.toggleAutoStart.addEventListener('click', () => {
    appData.settings.autoStart = toggleSwitch(els.toggleAutoStart);
    timer.updateSettings({ autoStart: appData.settings.autoStart });
    saveData();
  });

  els.toggleSound.addEventListener('click', () => {
    appData.settings.soundEnabled = toggleSwitch(els.toggleSound);
    saveData();
  });

  els.toggleNotification.addEventListener('click', () => {
    appData.settings.notificationEnabled = toggleSwitch(els.toggleNotification);
    saveData();
  });
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', init);
