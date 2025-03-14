const { session } = require('telegraf');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Инициализация сессии для бота
 * @returns {Function} Middleware для сессии
 */
function setupSession() {
  return session({
    // Функция для получения ключа сессии
    getSessionKey: (ctx) => {
      if (ctx.from && ctx.chat) {
        return `${ctx.from.id}:${ctx.chat.id}`;
      } else if (ctx.from) {
        return String(ctx.from.id);
      }
      return null;
    },
    // Обработчик ошибок сессии
    handlerError: (err) => {
      logger.error('Session error:', err);
    }
  });
}

/**
 * Middleware для инициализации состояния сессии
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function sessionMiddleware(ctx, next) {
  try {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Инициализируем данные пользователя в сессии
    if (!ctx.session.user) {
      ctx.session.user = {
        currentAction: null,
        lastCommand: null,
        lastInteraction: Date.now()
      };
    }
    
    // Обновляем время последнего взаимодействия
    ctx.session.user.lastInteraction = Date.now();
    
    return next();
  } catch (error) {
    logger.error('Error in session middleware:', error);
    return next();
  }
}

/**
 * Middleware для очистки устаревших сессий
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function cleanupSessionMiddleware(ctx, next) {
  try {
    // Проверяем, прошло ли достаточно времени с последнего взаимодействия
    const sessionTimeout = 30 * 60 * 1000; // 30 минут
    
    if (ctx.session && ctx.session.user && 
        (Date.now() - ctx.session.user.lastInteraction) > sessionTimeout) {
      // Очищаем сессию, если она устарела
      ctx.session = {};
      logger.debug(`Cleaned up session for user ${ctx.from?.id}`);
    }
    
    return next();
  } catch (error) {
    logger.error('Error in cleanup session middleware:', error);
    return next();
  }
}

module.exports = {
  setupSession,
  sessionMiddleware,
  cleanupSessionMiddleware
}; 