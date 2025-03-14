const { setupLogger } = require('../utils/logger');
const { handleSupportMessage, handleContinueSupportDialog, handleAdminReply } = require('../commands/support');
const { startCommand } = require('../commands/start');
const { helpCommand } = require('../commands/help');
const { subscribeCommand } = require('../commands/subscribe');
const { profileCommand } = require('../commands/profile');
const { supportCommand } = require('../commands/support');
const { isAdmin } = require('../commands/admin');

const logger = setupLogger();

/**
 * Обработчик текстовых сообщений
 * @param {Object} ctx - Контекст Telegram
 */
async function handleTextMessage(ctx) {
  try {
    // Проверяем, является ли пользователь администратором и отвечает ли на сообщение поддержки
    if (ctx.session.support && ctx.session.support.currentAction === 'replying_to_support' && isAdmin(ctx.from.id)) {
      logger.info(`Admin ${ctx.from.id} is replying to support message`);
      return await handleAdminReply(ctx);
    }
    
    // Проверяем, является ли сообщение ответом на сообщение от поддержки
    if (ctx.message.reply_to_message) {
      const handled = await handleContinueSupportDialog(ctx);
      if (handled) {
        logger.info(`User ${ctx.from.id} continued support dialog`);
        return;
      }
    }
    
    // Проверяем, находится ли пользователь в режиме написания сообщения в поддержку
    if (ctx.session.user && ctx.session.user.currentAction === 'writing_support_message') {
      logger.info(`User ${ctx.from.id} sent support message: ${ctx.message.text.substring(0, 100)}${ctx.message.text.length > 100 ? '...' : ''}`);
      return await handleSupportMessage(ctx);
    }
    
    // Если сообщение не обработано, отправляем справку
    logger.info(`Unhandled text message from user ${ctx.from.id}: ${ctx.message.text.substring(0, 100)}${ctx.message.text.length > 100 ? '...' : ''}`);
    await ctx.reply(
      'Я не понимаю эту команду. Пожалуйста, используйте меню или /help для получения списка доступных команд.'
    );
  } catch (error) {
    logger.error('Error in text message handler:', error);
    await ctx.reply('Произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Настройка обработчиков текстовых сообщений
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupTextHandlers(bot) {
  // Обработчик всех текстовых сообщений
  bot.on('text', handleTextMessage);
  
  logger.info('Text handlers set up successfully');
  
  return bot;
}

module.exports = {
  setupTextHandlers,
  handleTextMessage
}; 