const { Telegraf, session } = require('telegraf');
const { setupLogger } = require('./utils/logger');
const { setupMiddleware } = require('./middleware');
const setupHandlers = require('./config/handlers').setupHandlers;

// Импортируем настройки бота
const setupMiddlewares = require('./config/middlewares');
const setupCommands = require('./config/commands').setupCommands;
const setupCronJobs = require('./config/cron').setupCronJobs;

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
  
  // Настраиваем команды
  setupCommands(bot);
  
  // Настраиваем обработчики
  setupHandlers(bot);
  
  // Настраиваем cron-задачи
  setupCronJobs(bot);
  
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

// Инициализация бота
async function initBot(bot) {
  try {
    // Настраиваем middleware
    setupMiddlewares(bot);
    
    // Настраиваем команды, если функция существует
    if (typeof setupCommands === 'function') {
      setupCommands(bot);
    } else {
      logger.warn('Function setupCommands is not defined, skipping command setup');
    }
    
    // Настраиваем обработчики
    setupHandlers(bot);
    
    // Настраиваем cron-задачи, если функция существует
    if (typeof setupCronJobs === 'function') {
      setupCronJobs(bot);
    } else {
      logger.warn('Function setupCronJobs is not defined, skipping cron jobs setup');
    }
    
    // Запускаем бота
    await bot.launch();
    
    logger.info('Bot started successfully');
    
    // Обработка завершения работы
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    logger.error('Error initializing bot:', error);
    throw error;
  }
}

module.exports = {
  setupBot,
  initBot
}; 