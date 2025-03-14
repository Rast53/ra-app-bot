const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Middleware для обработки ошибок
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function errorMiddleware(ctx, next) {
  try {
    return await next();
  } catch (error) {
    // Логируем ошибку
    logger.error('Bot error:', {
      error: error.message,
      stack: error.stack,
      update: ctx.update
    });
    
    // Отправляем сообщение пользователю
    try {
      await ctx.reply(
        'Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
      );
    } catch (replyError) {
      logger.error('Error sending error message to user:', replyError);
    }
    
    // Отправляем уведомление администраторам
    try {
      const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];
      
      if (adminIds.length > 0) {
        const errorMessage = `🚨 *Ошибка в боте*\n\n` +
          `*Пользователь:* ${ctx.from?.id} (${ctx.from?.username || 'без имени'})\n` +
          `*Ошибка:* ${error.message}\n` +
          `*Время:* ${new Date().toISOString()}\n\n` +
          `*Стек:*\n\`\`\`\n${error.stack?.substring(0, 500) || 'Нет стека'}\n\`\`\``;
        
        for (const adminId of adminIds) {
          try {
            await ctx.telegram.sendMessage(adminId, errorMessage, { parse_mode: 'Markdown' });
          } catch (adminError) {
            logger.error(`Error sending error notification to admin ${adminId}:`, adminError);
          }
        }
      }
    } catch (notifyError) {
      logger.error('Error notifying admins about error:', notifyError);
    }
  }
}

module.exports = {
  errorMiddleware
}; 