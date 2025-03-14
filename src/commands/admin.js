const { Markup } = require('telegraf');
const { getUserStats, getAllUsers } = require('../services/user');
const { checkExpiredSubscriptions, getExpiringSubscriptions } = require('../services/subscription');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Обработчик команды /admin
 * @param {Object} ctx - Контекст Telegram
 */
async function adminCommand(ctx) {
  try {
    // Получаем статистику пользователей
    const stats = await getUserStats();
    
    // Формируем сообщение с информацией для администратора
    const message = `
*Панель администратора*

*Статистика:*
• Всего пользователей: ${stats.totalUsers}
• Активных подписок: ${stats.activeSubscriptions}
• Новых пользователей за сегодня: ${stats.newUsersToday}

Выберите действие:
`;
    
    // Создаем клавиатуру с действиями для администратора
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Статистика пользователей', 'admin_user_stats')],
      [Markup.button.callback('Проверить истекшие подписки', 'admin_check_expired')],
      [Markup.button.callback('Подписки, истекающие скоро', 'admin_expiring_soon')]
    ]);
    
    // Отправляем сообщение с информацией и клавиатурой
    await ctx.replyWithMarkdown(message, keyboard);
    
    logger.info(`Admin ${ctx.from.id} accessed admin panel`);
  } catch (error) {
    logger.error('Error in admin command:', error);
    await ctx.reply('Произошла ошибка при получении информации для администратора. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик получения статистики пользователей
 * @param {Object} ctx - Контекст Telegram
 */
async function handleAdminUserStats(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Получаем список всех пользователей
    const users = await getAllUsers();
    
    // Формируем сообщение со статистикой
    let message = `
*Статистика пользователей*

*Всего пользователей:* ${users.length}
*Последние 5 пользователей:*
`;
    
    // Добавляем информацию о последних 5 пользователях
    const lastUsers = users.slice(0, 5);
    
    for (const user of lastUsers) {
      const registrationDate = new Date(user.created_at).toLocaleDateString('ru-RU');
      message += `• ${user.first_name} ${user.last_name || ''} (@${user.username || 'нет'}) - ${registrationDate}\n`;
    }
    
    // Отправляем сообщение со статистикой
    await ctx.replyWithMarkdown(message);
    
    logger.info(`Admin ${ctx.from.id} viewed user statistics`);
  } catch (error) {
    logger.error('Error in admin user stats handler:', error);
    await ctx.reply('Произошла ошибка при получении статистики пользователей. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик проверки истекших подписок
 * @param {Object} ctx - Контекст Telegram
 */
async function handleAdminCheckExpired(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Получаем список истекших подписок
    const expiredSubscriptions = await checkExpiredSubscriptions();
    
    // Формируем сообщение с информацией об истекших подписках
    let message = `
*Истекшие подписки*

*Всего истекших подписок:* ${expiredSubscriptions.length}
`;
    
    if (expiredSubscriptions.length > 0) {
      message += '\n*Список истекших подписок:*\n';
      
      for (const subscription of expiredSubscriptions) {
        const endDate = new Date(subscription.end_date).toLocaleDateString('ru-RU');
        message += `• ID: ${subscription.telegram_id}, План: ${subscription.plan_id}, Дата окончания: ${endDate}\n`;
      }
    } else {
      message += '\nНет истекших подписок.';
    }
    
    // Отправляем сообщение с информацией об истекших подписках
    await ctx.replyWithMarkdown(message);
    
    logger.info(`Admin ${ctx.from.id} checked expired subscriptions`);
  } catch (error) {
    logger.error('Error in admin check expired handler:', error);
    await ctx.reply('Произошла ошибка при проверке истекших подписок. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик получения подписок, истекающих скоро
 * @param {Object} ctx - Контекст Telegram
 */
async function handleAdminExpiringSoon(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Получаем список подписок, истекающих в ближайшие 3 дня
    const expiringSubscriptions = await getExpiringSubscriptions(3);
    
    // Формируем сообщение с информацией о подписках, истекающих скоро
    let message = `
*Подписки, истекающие в ближайшие 3 дня*

*Всего подписок:* ${expiringSubscriptions.length}
`;
    
    if (expiringSubscriptions.length > 0) {
      message += '\n*Список подписок:*\n';
      
      for (const subscription of expiringSubscriptions) {
        const endDate = new Date(subscription.end_date).toLocaleDateString('ru-RU');
        message += `• ID: ${subscription.telegram_id}, План: ${subscription.plan_id}, Дата окончания: ${endDate}\n`;
      }
    } else {
      message += '\nНет подписок, истекающих в ближайшие 3 дня.';
    }
    
    // Отправляем сообщение с информацией о подписках, истекающих скоро
    await ctx.replyWithMarkdown(message);
    
    logger.info(`Admin ${ctx.from.id} checked expiring subscriptions`);
  } catch (error) {
    logger.error('Error in admin expiring soon handler:', error);
    await ctx.reply('Произошла ошибка при получении подписок, истекающих скоро. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  adminCommand,
  handleAdminUserStats,
  handleAdminCheckExpired,
  handleAdminExpiringSoon
}; 