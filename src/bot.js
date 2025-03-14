const { Telegraf, session } = require('telegraf');
const { setupLogger } = require('./utils/logger');
const { setupMiddleware } = require('./middleware');
const { setupHandlers } = require('./handlers');

const logger = setupLogger();

/**
 * Инициализация и настройка бота
 * @returns {Object} Настроенный экземпляр бота
 */
function setupBot() {
  // Проверяем наличие токена
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error('BOT_TOKEN не указан в переменных окружения');
  }
  
  // Создаем экземпляр бота
  const bot = new Telegraf(token);
  
  // Настраиваем сессию
  bot.use(session());
  
  // Настраиваем middleware
  setupMiddleware(bot);
  
  // Настраиваем обработчики
  setupHandlers(bot);
  
  // Обработчик ошибок
  bot.catch((err, ctx) => {
    logger.error(`Error in bot: ${err.message}`, err);
    
    // Отправляем сообщение об ошибке пользователю
    if (ctx) {
      ctx.reply('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.');
    }
  });
  
  logger.info('Bot setup completed successfully');
  
  return bot;
}

module.exports = {
  setupBot
}; 