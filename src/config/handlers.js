const { handleTextMessage } = require('../handlers/text');
const { handleCallbackQuery } = require('../handlers/callback');
const { handlePreCheckoutQuery, handleSuccessfulPayment } = require('../handlers/payment');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Настройка обработчиков для бота
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupHandlers(bot) {
  // Обработчик текстовых сообщений
  bot.on('text', handleTextMessage);
  
  // Обработчик callback-запросов
  bot.on('callback_query', handleCallbackQuery);
  
  // Обработчики платежей
  bot.on('pre_checkout_query', handlePreCheckoutQuery);
  bot.on('successful_payment', handleSuccessfulPayment);
  
  logger.info('Bot handlers set up successfully');
  
  return bot;
}

module.exports = {
  setupHandlers
};