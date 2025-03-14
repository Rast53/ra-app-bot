const { setupLogger } = require('../utils/logger');
const { setupCommandHandlers } = require('./commands');
const { setupCallbackHandlers } = require('./callback');
const { setupTextHandlers } = require('./text');
const { setupSupportChatHandlers } = require('./support-chat');

const logger = setupLogger();

/**
 * Настройка всех обработчиков бота
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupHandlers(bot) {
  // Сначала настраиваем обработчик чата поддержки
  bot = setupSupportChatHandlers(bot);
  
  // Затем настраиваем остальные обработчики
  bot = setupCommandHandlers(bot);
  bot = setupCallbackHandlers(bot);
  bot = setupTextHandlers(bot);
  
  logger.info('All handlers set up successfully');
  
  return bot;
}

module.exports = {
  setupHandlers
}; 