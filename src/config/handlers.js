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
  try {
    // Настройка обработчиков для чата поддержки
    // Важно: этот обработчик должен быть первым, чтобы перехватывать сообщения в чате поддержки
    if (typeof setupSupportChatHandlers === 'function') {
      setupSupportChatHandlers(bot);
    } else {
      logger.warn('Function setupSupportChatHandlers is not defined, skipping support chat handlers setup');
    }
    
    // Обработчик текстовых сообщений
    if (typeof handleTextMessage === 'function') {
      bot.on('text', handleTextMessage);
    } else {
      logger.warn('Function handleTextMessage is not defined, skipping text message handler setup');
    }
    
    // Обработчик callback-запросов
    if (typeof handleCallbackQuery === 'function') {
      bot.on('callback_query', handleCallbackQuery);
    } else {
      logger.warn('Function handleCallbackQuery is not defined, skipping callback query handler setup');
    }
    
    // Обработчики платежей
    if (typeof handlePreCheckoutQuery === 'function') {
      bot.on('pre_checkout_query', handlePreCheckoutQuery);
    } else {
      logger.warn('Function handlePreCheckoutQuery is not defined, skipping pre checkout query handler setup');
    }
    
    if (typeof handleSuccessfulPayment === 'function') {
      bot.on('successful_payment', handleSuccessfulPayment);
    } else {
      logger.warn('Function handleSuccessfulPayment is not defined, skipping successful payment handler setup');
    }
    
    logger.info('Bot handlers set up successfully');
  } catch (error) {
    logger.error('Error setting up handlers:', error);
  }
  
  return bot;
}

module.exports = {
  setupHandlers
};