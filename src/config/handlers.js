const { handleTextMessage } = require('../handlers/text');
const { handleCallbackQuery } = require('../handlers/callback');
const { handlePreCheckoutQuery, handleSuccessfulPayment } = require('../handlers/payment');
const { setupSupportChatHandlers } = require('../handlers/support-chat');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Настройка обработчиков для бота
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupHandlers(bot) {
  // Настройка обработчиков для чата поддержки
  // Важно: этот обработчик должен быть первым, чтобы перехватывать сообщения в чате поддержки
  setupSupportChatHandlers(bot);
  
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