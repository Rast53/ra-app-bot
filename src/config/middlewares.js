const { session } = require('telegraf');
const { setupLogger } = require('../utils/logger');
const { authMiddleware } = require('../middlewares/auth');
const { errorMiddleware } = require('../middlewares/error');

const logger = setupLogger();

/**
 * Настройка middleware для бота
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function setupMiddlewares(bot) {
  try {
    // Middleware для обработки ошибок
    if (typeof errorMiddleware === 'function') {
      bot.use(errorMiddleware);
    } else {
      logger.warn('Function errorMiddleware is not defined, skipping error middleware setup');
    }
    
    // Middleware для сессий пользователей
    bot.use(session());
    
    // Middleware для аутентификации пользователя
    if (typeof authMiddleware === 'function') {
      bot.use(authMiddleware);
    } else {
      logger.warn('Function authMiddleware is not defined, skipping auth middleware setup');
    }
    
    logger.info('Bot middlewares set up successfully');
  } catch (error) {
    logger.error('Error setting up bot middlewares:', error);
  }
}

module.exports = setupMiddlewares; 