const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Создаем директорию для логов, если она не существует
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * Настройка логгера
 * @returns {winston.Logger} Настроенный логгер
 */
function setupLogger() {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'ra-app-bot' },
    transports: [
      // Запись всех логов уровня 'error' и ниже в 'error.log'
      new winston.transports.File({ 
        filename: path.join(logDir, 'error.log'), 
        level: 'error' 
      }),
      // Запись всех логов в 'combined.log'
      new winston.transports.File({ 
        filename: path.join(logDir, 'combined.log') 
      })
    ]
  });

  // Если не в продакшене, также выводим логи в консоль
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  return logger;
}

module.exports = {
  setupLogger
}; 