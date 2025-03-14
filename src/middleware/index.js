const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Middleware для инициализации сессии пользователя
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function sessionMiddleware(ctx, next) {
  try {
    // Инициализируем объект сессии, если его нет
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Инициализируем объект пользователя в сессии, если его нет
    if (!ctx.session.user) {
      ctx.session.user = {
        currentAction: null,
        lastCommand: null
      };
    }
    
    // Инициализируем объект поддержки в сессии, если его нет
    if (!ctx.session.support) {
      ctx.session.support = {
        currentAction: null,
        replyToUserId: null,
        replyToMessageId: null
      };
    }
    
    return next();
  } catch (error) {
    logger.error('Error in session middleware:', error);
    return next();
  }
}

/**
 * Middleware для логирования запросов
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function loggingMiddleware(ctx, next) {
  try {
    const startTime = Date.now();
    
    // Логируем информацию о запросе
    if (ctx.updateType) {
      const userId = ctx.from ? ctx.from.id : 'unknown';
      const username = ctx.from ? ctx.from.username || 'no_username' : 'unknown';
      
      logger.info(`Request [${ctx.updateType}] from user ${userId} (@${username})`);
    }
    
    // Выполняем следующий middleware
    await next();
    
    // Логируем время выполнения запроса
    const responseTime = Date.now() - startTime;
    logger.info(`Response time: ${responseTime}ms`);
  } catch (error) {
    logger.error('Error in logging middleware:', error);
    return next();
  }
}

/**
 * Настройка всех middleware для бота
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupMiddleware(bot) {
  // Регистрируем middleware
  bot.use(sessionMiddleware);
  bot.use(loggingMiddleware);
  
  logger.info('Middleware set up successfully');
  
  return bot;
}

module.exports = {
  setupMiddleware
}; 