const { setupLogger } = require('../utils/logger');
const { handlePlanSelection, handleCancelSubscription } = require('../commands/subscribe');
const { handleCancelActiveSubscription, handleConfirmCancelSubscription, handleCancelOperation } = require('../commands/profile');
const { handleGetReceipt } = require('../commands/receipt');
const { handleWriteSupportMessage, handleReplyToUserStart } = require('../commands/support');
const { handleAdminUserStats, handleAdminCheckExpired, handleAdminExpiringSoon, handleMarkAsRead } = require('../commands/admin');
const { subscribeCommand } = require('../commands/subscribe');
const { profileCommand } = require('../commands/profile');
const { handleReceiptSelection } = require('../commands/receipt');
const { 
  handleAdminSupport, 
  handleMarkRead, 
  handleAdminReplyStart,
  handleSupportStats,
  handleUserStats,
  handleSupportLogs,
  handleViewSupportDialog,
  handleSupportUsers
} = require('../commands/admin');
const { handleAdminPanelButton } = require('../handlers/support-chat');

const logger = setupLogger();

/**
 * Обработчик callback-запросов
 * @param {Object} ctx - Контекст Telegram
 */
async function handleCallbackQuery(ctx) {
  try {
    const callbackData = ctx.callbackQuery.data;
    
    // Обрабатываем различные типы callback-запросов с регулярными выражениями
    if (callbackData.startsWith('select_plan:')) {
      return handlePlanSelection(ctx);
    }
    
    if (callbackData.startsWith('reply_to_user:')) {
      return handleReplyToUserStart(ctx);
    }
    
    if (callbackData.startsWith('mark_read:')) {
      return handleMarkRead(ctx);
    }
    
    if (callbackData.startsWith('admin_reply:')) {
      return handleAdminReplyStart(ctx);
    }
    
    if (callbackData.startsWith('view_dialog:')) {
      return handleViewSupportDialog(ctx);
    }
    
    if (callbackData.startsWith('select_receipt:')) {
      return handleReceiptSelection(ctx);
    }
    
    // Обрабатываем простые callback-запросы
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
        return handleUserStats(ctx);
      
      case 'admin_check_expired':
        return handleAdminCheckExpired(ctx);
      
      case 'admin_expiring_soon':
        return handleAdminExpiringSoon(ctx);
      
      case 'admin_support':
        return handleAdminSupport(ctx);
      
      case 'admin_support_stats':
        return handleSupportStats(ctx);
      
      case 'admin_support_logs':
        return handleSupportLogs(ctx);
      
      case 'admin_support_users':
        return handleSupportUsers(ctx);
      
      case 'admin_panel':
        return handleAdminPanelButton(ctx);
      
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

/**
 * Настройка обработчиков callback-запросов
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupCallbackHandlers(bot) {
  // Обработчик для написания сообщения в поддержку
  bot.action('write_support_message', handleWriteSupportMessage);
  
  // Обработчик для ответа на сообщение пользователя из чата поддержки
  bot.action(/^reply_to_user:(\d+)$/, handleReplyToUserStart);
  
  // Обработчик для выбора плана подписки
  bot.action(/^select_plan:(\d+)$/, handlePlanSelection);
  
  // Обработчик для отмены подписки
  bot.action('cancel_subscription', handleCancelSubscription);
  
  // Обработчик для выбора чека
  bot.action(/^select_receipt:(\d+)$/, handleReceiptSelection);
  
  // Обработчики для админ-панели
  bot.action('admin_panel', handleAdminPanelButton);
  bot.action('admin_support', handleAdminSupport);
  bot.action('admin_support_stats', handleSupportStats);
  bot.action('admin_support_logs', handleSupportLogs);
  bot.action('admin_support_users', handleSupportUsers);
  bot.action('admin_user_stats', handleUserStats);
  
  // Обработчик для отметки сообщения как прочитанного
  bot.action(/^mark_read:(\d+)$/, handleMarkRead);
  
  // Обработчик для начала ответа на сообщение
  bot.action(/^admin_reply:(\d+):(\d+)$/, handleAdminReplyStart);
  
  // Обработчик для просмотра диалога поддержки
  bot.action(/^view_dialog:(\d+)$/, handleViewSupportDialog);
  
  // Обработчик для всех неизвестных callback-запросов
  bot.on('callback_query', async (ctx) => {
    try {
      logger.warn(`Unknown callback query: ${ctx.callbackQuery.data}`);
      await ctx.answerCbQuery('Неизвестный запрос или устаревшая кнопка');
    } catch (error) {
      logger.error('Error in unknown callback handler:', error);
    }
  });
  
  logger.info('Callback handlers set up successfully');
  
  return bot;
}

module.exports = {
  handleCallbackQuery,
  setupCallbackHandlers
}; 