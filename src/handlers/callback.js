const { setupLogger } = require('../utils/logger');
const { handlePlanSelection, handleCancelSubscription } = require('../commands/subscribe');
const { handleCancelActiveSubscription, handleConfirmCancelSubscription, handleCancelOperation } = require('../commands/profile');
const { handleGetReceipt } = require('../commands/receipt');
const { handleWriteSupportMessage, handleReplyToUserStart } = require('../commands/support');
const { 
  handleAdminUserStats, 
  handleAdminCheckExpired, 
  handleAdminExpiringSoon, 
  handleMarkRead,
  handleAdminSupport,
  handleAdminReplyStart,
  handleSupportStats,
  handleUserStats,
  handleSupportLogs,
  handleViewSupportDialog,
  handleSupportUsers
} = require('../commands/admin');
const { subscribeCommand } = require('../commands/subscribe');
const { profileCommand } = require('../commands/profile');
const { handleReceiptSelection } = require('../commands/receipt');
const { handleChangeSubscription, handleCancelPlanSelection, handleKeepSubscription } = require('../commands/subscription');
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
    
    if (callbackData.startsWith('confirm_plan:')) {
      return handlePlanSelection(ctx);
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
      
      case 'change_subscription':
        return handleChangeSubscription(ctx);
      
      case 'cancel_plan_selection':
        return handleCancelPlanSelection(ctx);
      
      case 'keep_subscription':
        return handleKeepSubscription(ctx);
      
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
  bot.action(/^reply_to_user:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.match[1];
    await ctx.reply(`Ответ пользователю ${userId} временно недоступен.`);
    logger.info(`User ${ctx.from.id} tried to reply to user ${userId} (temporary handler)`);
  });
  
  // Обработчик для выбора плана подписки
  bot.action(/^select_plan:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const planId = ctx.match[1];
    await ctx.reply(`Выбор плана ${planId} временно недоступен.`);
    logger.info(`User ${ctx.from.id} tried to select plan ${planId} (temporary handler)`);
  });
  
  // Обработчик для подтверждения выбора плана
  bot.action(/^confirm_plan:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const planId = ctx.match[1];
    await ctx.reply(`Подтверждение плана ${planId} временно недоступно.`);
    logger.info(`User ${ctx.from.id} tried to confirm plan ${planId} (temporary handler)`);
  });
  
  // Обработчик для отмены подписки
  bot.action('cancel_subscription', handleCancelSubscription);
  
  // Обработчик для изменения подписки
  bot.action('change_subscription', handleChangeSubscription);
  
  // Обработчик для отмены выбора плана
  bot.action('cancel_plan_selection', handleCancelPlanSelection);
  
  // Обработчик для отмены отмены подписки
  bot.action('keep_subscription', handleKeepSubscription);
  
  // Обработчик для выбора чека
  bot.action(/^select_receipt:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const receiptId = ctx.match[1];
    await ctx.reply(`Выбор чека ${receiptId} временно недоступен.`);
    logger.info(`User ${ctx.from.id} tried to select receipt ${receiptId} (temporary handler)`);
  });
  
  // Обработчики для админ-панели
  // Временно отключаем все обработчики админ-панели, которые могут вызывать ошибку
  bot.action('admin_panel', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Админ-панель временно недоступна. Ведутся технические работы.');
    logger.info(`User ${ctx.from.id} tried to access admin panel (temporary handler)`);
  });
  
  // Временные обработчики для всех админ-функций
  const tempAdminHandler = async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Функция временно недоступна. Ведутся технические работы.');
    logger.info(`User ${ctx.from.id} tried to access admin function (temporary handler): ${ctx.callbackQuery.data}`);
  };
  
  bot.action('admin_support', tempAdminHandler);
  bot.action('admin_support_stats', tempAdminHandler);
  bot.action('admin_support_logs', tempAdminHandler);
  bot.action('admin_support_users', tempAdminHandler);
  bot.action('admin_user_stats', tempAdminHandler);
  
  // Обработчик для отметки сообщения как прочитанного
  bot.action(/^mark_read:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const messageId = ctx.match[1];
    await ctx.reply(`Сообщение ${messageId} отмечено как прочитанное (временный обработчик).`);
    logger.info(`User ${ctx.from.id} tried to mark message ${messageId} as read (temporary handler)`);
  });
  
  // Обработчик для начала ответа на сообщение
  bot.action(/^admin_reply:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.match[1];
    const messageId = ctx.match[2];
    await ctx.reply(`Ответ пользователю ${userId} на сообщение ${messageId} временно недоступен.`);
    logger.info(`User ${ctx.from.id} tried to reply to user ${userId} message ${messageId} (temporary handler)`);
  });
  
  // Обработчик для просмотра диалога поддержки
  bot.action(/^view_dialog:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dialogId = ctx.match[1];
    await ctx.reply(`Просмотр диалога ${dialogId} временно недоступен.`);
    logger.info(`User ${ctx.from.id} tried to view dialog ${dialogId} (temporary handler)`);
  });
  
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