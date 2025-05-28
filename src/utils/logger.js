const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', '..', 'logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFileName() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    return path.join(this.logDir, `app-${dateStr}.log`);
  }

  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  }

  writeToFile(level, message) {
    try {
      const logFile = this.getLogFileName();
      const formattedMessage = this.formatMessage(level, message);
      fs.appendFileSync(logFile, formattedMessage);
    } catch (error) {
      console.error('로그 파일 쓰기 오류:', error);
    }
  }

  info(message) {
    console.log(`[INFO] ${message}`);
    this.writeToFile('info', message);
  }

  warn(message) {
    console.warn(`[WARN] ${message}`);
    this.writeToFile('warn', message);
  }

  error(message) {
    console.error(`[ERROR] ${message}`);
    this.writeToFile('error', message);
  }

  success(message) {
    console.log(`[SUCCESS] ${message}`);
    this.writeToFile('success', message);
  }
}

module.exports = new Logger();