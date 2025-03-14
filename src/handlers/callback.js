const { setupLogger } = require('../utils/logger');
const { handlePlanSelection, handleCancelSubscription } = require('../commands/subscribe');
const { handleCancelActiveSubscription, handleConfirmCancelSubscription, handleCancelOperation } = require('../commands/profile');
const { handleGetReceipt } = require('../commands/receipt');
const { handleWriteSupportMessage, handleReplyToUserStart } = require('../commands/support');
const { handleAdminUserStats, handleAdminCheckExpired, handleAdminExpiringSoon, handleMarkAsRead } = require('../commands/admin');
const { subscribeCommand } = require('../commands/subscribe');
const { profileCommand } = require('../commands/profile');

const logger = setupLogger();

/**
 * Обработчик callback-запросов
 * @param {Object} ctx - Контекст Telegram
 */
async function handleCallbackQuery(ctx) {
  try {
    const callbackData = ctx.callbackQuery.data;
    
    // Обрабатываем различные типы callback-запросов
    if (callbackData.startsWith('select_plan:')) {
      return handlePlanSelection(ctx);
    }
    
    if (callbackData.startsWith('reply_to_user:')) {
      return handleReplyToUserStart(ctx);
    }
    
    if (callbackData.startsWith('mark_read:')) {
      return handleMarkAsRead(ctx);
    }
    
    switch (callbackData) {
      case 'subscribe':
        await ctx.answerCbQuery();
        return subscribeCommand(ctx);
      
      case 'profile':
        await ctx.answerCbQuery();
        return profileCommand(ctx);
      
      case 'more_info':
        await ctx.answerCbQuery();
        return ctx.reply(
          'Наш сервис предоставляет доступ к различным функциям и возможностям. ' +
          'Оформите подписку, чтобы получить полный доступ ко всем возможностям сервиса.'
        );
      
      case 'cancel_subscription':
        return handleCancelSubscription(ctx);
      
      case 'cancel_active_subscription':
        return handleCancelActiveSubscription(ctx);
      
      case 'confirm_cancel_subscription':
        return handleConfirmCancelSubscription(ctx);
      
      case 'cancel_operation':
        return handleCancelOperation(ctx);
      
      case 'get_receipt':
        return handleGetReceipt(ctx);
      
      case 'write_support_message':
        return handleWriteSupportMessage(ctx);
      
      case 'admin_user_stats':
        return handleAdminUserStats(ctx);
      
      case 'admin_check_expired':
        return handleAdminCheckExpired(ctx);
      
      case 'admin_expiring_soon':
        return handleAdminExpiringSoon(ctx);
      
      default:
        await ctx.answerCbQuery('Неизвестная команда');
        logger.warn(`Unknown callback query: ${callbackData}`);
    }
  } catch (error) {
    logger.error('Error in callback query handler:', error);
    await ctx.answerCbQuery('Произошла ошибка при обработке запроса');
    await ctx.reply('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  handleCallbackQuery
}; 