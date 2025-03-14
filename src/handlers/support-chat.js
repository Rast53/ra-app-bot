const { setupLogger } = require('../utils/logger');
const { handleSupportReply, SUPPORT_CHAT_ID } = require('../commands/support');

const logger = setupLogger();

/**
 * Настройка обработчиков для чата поддержки
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupSupportChatHandlers(bot) {
  // Обработчик всех текстовых сообщений в чате поддержки
  bot.on('text', async (ctx, next) => {
    try {
      // Проверяем, что сообщение отправлено в чат поддержки
      if (ctx.chat && ctx.chat.id === SUPPORT_CHAT_ID) {
        logger.info(`Message in support chat from user ${ctx.from.id}: ${ctx.message.text}`);
        
        // Если это ответ на сообщение
        if (ctx.message.reply_to_message) {
          // Проверяем, что это ответ на сообщение от бота
          if (ctx.message.reply_to_message.from && ctx.message.reply_to_message.from.id === ctx.botInfo.id) {
            logger.info(`Processing reply to bot message in support chat: ${ctx.message.text}`);
            await handleSupportReply(ctx);
            return;
          }
        }
      }
      
      // Если это не сообщение в чате поддержки или не ответ, передаем управление следующему обработчику
      return next();
    } catch (error) {
      logger.error('Error in support chat handler:', error);
      return next();
    }
  });
  
  logger.info('Support chat handlers set up successfully');
  
  return bot;
}

module.exports = {
  setupSupportChatHandlers
}; 