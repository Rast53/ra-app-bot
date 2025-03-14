const { setupSession, sessionMiddleware, cleanupSessionMiddleware } = require('../middlewares/session');
const { userMiddleware, subscriptionMiddleware } = require('../middlewares/auth');
const { errorMiddleware } = require('../middlewares/error');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Настройка middleware для бота
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupMiddlewares(bot) {
  // Устанавливаем middleware для обработки ошибок
  bot.use(errorMiddleware);
  
  // Устанавливаем middleware для сессий
  bot.use(setupSession());
  bot.use(sessionMiddleware);
  bot.use(cleanupSessionMiddleware);
  
  // Устанавливаем middleware для пользователей и подписок
  bot.use(userMiddleware);
  bot.use(subscriptionMiddleware);
  
  logger.info('Bot middlewares set up successfully');
  
  return bot;
}

module.exports = {
  setupMiddlewares
}; 