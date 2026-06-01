/**
 * 番茄钟计时器核心逻辑
 */
class PomodoroTimer {
  constructor(options = {}) {
    this.workTime = options.workTime || 25; // 分钟
    this.shortBreak = options.shortBreak || 5;
    this.longBreak = options.longBreak || 15;
    this.longBreakInterval = options.longBreakInterval || 4;
    this.autoStart = options.autoStart || false;

    this.currentMode = 'work'; // 'work' | 'shortBreak' | 'longBreak'
    this.timeLeft = this.workTime * 60; // 剩余秒数
    this.isRunning = false;
    this.completedPomodoros = 0; // 当前会话完成的番茄数
    this.timerId = null;

    this.onTick = options.onTick || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onModeChange = options.onModeChange || (() => {});
  }

  // 获取当前模式的时长（分钟）
  getCurrentDuration() {
    switch (this.currentMode) {
      case 'work': return this.workTime;
      case 'shortBreak': return this.shortBreak;
      case 'longBreak': return this.longBreak;
      default: return this.workTime;
    }
  }

  // 更新设置
  updateSettings(settings) {
    this.workTime = settings.workTime ?? this.workTime;
    this.shortBreak = settings.shortBreak ?? this.shortBreak;
    this.longBreak = settings.longBreak ?? this.longBreak;
    this.longBreakInterval = settings.longBreakInterval ?? this.longBreakInterval;
    this.autoStart = settings.autoStart ?? this.autoStart;

    // 如果当前不在运行，重置当前模式的剩余时间
    if (!this.isRunning) {
      this.timeLeft = this.getCurrentDuration() * 60;
      this.onTick(this.timeLeft);
    }
  }

  // 开始计时
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timerId = setInterval(() => {
      this.timeLeft--;
      this.onTick(this.timeLeft);

      if (this.timeLeft <= 0) {
        this.complete();
      }
    }, 1000);
  }

  // 暂停计时
  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.timerId);
    this.timerId = null;
  }

  // 重置当前模式
  reset() {
    this.pause();
    this.timeLeft = this.getCurrentDuration() * 60;
    this.onTick(this.timeLeft);
  }

  // 跳过当前阶段，直接进入下一个
  skip() {
    this.pause();
    this.switchMode();
  }

  // 计时完成
  complete() {
    this.pause();

    if (this.currentMode === 'work') {
      this.completedPomodoros++;
    }

    this.onComplete(this.currentMode);
    this.switchMode();
  }

  // 切换模式
  switchMode() {
    const previousMode = this.currentMode;

    if (previousMode === 'work') {
      // 工作完成后进入休息
      if (this.completedPomodoros > 0 && this.completedPomodoros % this.longBreakInterval === 0) {
        this.currentMode = 'longBreak';
      } else {
        this.currentMode = 'shortBreak';
      }
    } else {
      // 休息完成后进入工作
      this.currentMode = 'work';
    }

    this.timeLeft = this.getCurrentDuration() * 60;
    this.onModeChange(this.currentMode);
    this.onTick(this.timeLeft);

    // 自动开始下一个计时
    if (this.autoStart) {
      // 稍微延迟一下，让用户有时间看到模式切换
      setTimeout(() => this.start(), 1500);
    }
  }

  // 手动设置模式
  setMode(mode) {
    this.pause();
    this.currentMode = mode;
    this.timeLeft = this.getCurrentDuration() * 60;
    this.onModeChange(this.currentMode);
    this.onTick(this.timeLeft);
  }

  // 获取格式化的时间字符串 MM:SS
  static formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // 获取进度（0 ~ 1）
  getProgress() {
    const total = this.getCurrentDuration() * 60;
    return (total - this.timeLeft) / total;
  }

  // 获取当前模式的显示名称
  getModeName() {
    switch (this.currentMode) {
      case 'work': return '专注中';
      case 'shortBreak': return '短休息';
      case 'longBreak': return '长休息';
      default: return '专注中';
    }
  }

  // 销毁计时器
  destroy() {
    this.pause();
  }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PomodoroTimer;
}
