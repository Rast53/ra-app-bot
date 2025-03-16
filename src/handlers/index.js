const { setupLogger } = require('../utils/logger');
const { setupCommandHandlers } = require('./commands');
const { setupCallbackHandlers } = require('./callback');
const { setupSupportChatHandlers } = require('./support-chat');
const { setupTextHandlers } = require('./text');

const logger = setupLogger();

/**
 * Настройка обработчиков бота
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupHandlers(bot) {
  try {
    // Настраиваем обработчики команд
    setupCommandHandlers(bot);
    logger.info('Command handlers set up successfully');
    
    // Настраиваем обработчики чата поддержки
    setupSupportChatHandlers(bot);
    logger.info('Support chat handlers set up successfully');
    
    // Настраиваем обработчики callback-запросов
    setupCallbackHandlers(bot);
    logger.info('Callback handlers set up successfully');
    
    // Настраиваем обработчики текстовых сообщений
    setupTextHandlers(bot);
    logger.info('Text handlers set up successfully');
    
    return bot;
  } catch (error) {
    logger.error('Error setting up handlers:', error);
    throw error;
  }
}

module.exports = {
  setupHandlers
}; 