const { setupLogger } = require('../utils/logger');
const { handleSupportMessage, handleContinueSupportDialog, handleAdminReply } = require('../commands/support');
const { startCommand } = require('../commands/start');
const { helpCommand } = require('../commands/help');
const { subscribeCommand } = require('../commands/subscribe');
const { profileCommand } = require('../commands/profile');
const { supportCommand } = require('../commands/support');

const logger = setupLogger();

/**
 * Обработчик текстовых сообщений
 * @param {Object} ctx - Контекст Telegram
 */
async function handleTextMessage(ctx) {
  try {
    const text = ctx.message.text;
    
    // Проверяем, находится ли пользователь в режиме написания сообщения в поддержку
    if (ctx.session.user.currentAction === 'writing_support_message') {
      return handleSupportMessage(ctx);
    }
    
    // Проверяем, является ли сообщение ответом на сообщение от поддержки
    const isReplyToSupport = await handleContinueSupportDialog(ctx);
    if (isReplyToSupport) {
      return;
    }
    
    // Проверяем, находится ли администратор в режиме ответа на сообщение поддержки
    if (ctx.session.support && ctx.session.support.currentAction === 'replying_to_user') {
      return handleAdminReply(ctx);
    }
    
    // Обрабатываем текстовые команды с клавиатуры
    switch (text) {
      case '💳 Подписка':
        return subscribeCommand(ctx);
      
      case '👤 Профиль':
        return profileCommand(ctx);
      
      case 'ℹ️ Помощь':
        return helpCommand(ctx);
      
      case '📞 Поддержка':
        return supportCommand(ctx);
      
      default:
        // Если сообщение не соответствует ни одной команде, отправляем приветственное сообщение
        if (!ctx.session.user.lastCommand) {
          return startCommand(ctx);
        }
    }
  } catch (error) {
    logger.error('Error in text message handler:', error);
    await ctx.reply('Произошла ошибка при обработке сообщения. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  handleTextMessage
}; 