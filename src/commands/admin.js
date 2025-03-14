const { Markup } = require('telegraf');
const { getUserStats, getAllUsers } = require('../services/user');
const { checkExpiredSubscriptions, getExpiringSubscriptions } = require('../services/subscription');
const { setupLogger } = require('../utils/logger');
const { query } = require('../services/database');

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

/**
 * Обработчик команды /admin_support
 * @param {Object} ctx - Контекст Telegram
 */
async function adminSupportCommand(ctx) {
  try {
    // Проверяем, существует ли таблица support_messages
    const tableResult = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_messages'
      )`
    );
    
    if (!tableResult.rows[0].exists) {
      return ctx.reply('Таблица сообщений поддержки не найдена.');
    }
    
    // Получаем непрочитанные сообщения поддержки
    const result = await query(
      `SELECT sm.*, u.first_name, u.last_name, u.username
       FROM support_messages sm
       JOIN users u ON sm.user_id = u.id
       WHERE sm.is_read = false
       ORDER BY sm.created_at DESC
       LIMIT 10`
    );
    
    if (result.rows.length === 0) {
      return ctx.reply('Нет непрочитанных сообщений поддержки.');
    }
    
    // Формируем сообщение с непрочитанными сообщениями
    let message = `*Непрочитанные сообщения поддержки (${result.rows.length}):*\n\n`;
    
    for (const [index, row] of result.rows.entries()) {
      const username = row.username ? `@${row.username}` : 'без имени';
      const date = new Date(row.created_at).toLocaleString('ru-RU');
      
      message += `*Сообщение #${index + 1}*\n`;
      message += `От: ${row.first_name} ${row.last_name || ''} (${username})\n`;
      message += `ID: ${row.telegram_id}\n`;
      message += `Дата: ${date}\n`;
      message += `Сообщение: ${row.message}\n\n`;
      
      // Создаем кнопки для каждого сообщения
      const buttons = [
        [
          Markup.button.callback(`✅ Отметить как прочитанное #${index + 1}`, `mark_read:${row.id}`),
          Markup.button.callback(`↩️ Ответить #${index + 1}`, `reply_to_user:${row.telegram_id}`)
        ]
      ];
      
      // Отправляем сообщение с кнопками
      await ctx.replyWithMarkdown(
        `*Сообщение #${index + 1}*\n` +
        `От: ${row.first_name} ${row.last_name || ''} (${username})\n` +
        `ID: ${row.telegram_id}\n` +
        `Дата: ${date}\n` +
        `Сообщение: ${row.message}`,
        Markup.inlineKeyboard(buttons)
      );
    }
    
    logger.info(`Admin ${ctx.from.id} viewed support messages`);
  } catch (error) {
    logger.error('Error in admin support command:', error);
    await ctx.reply('Произошла ошибка при получении сообщений поддержки. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик отметки сообщения как прочитанного
 * @param {Object} ctx - Контекст Telegram
 */
async function handleMarkAsRead(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Получаем ID сообщения из callback_data
    const messageId = parseInt(ctx.callbackQuery.data.split(':')[1]);
    
    // Отмечаем сообщение как прочитанное
    const result = await query(
      `UPDATE support_messages
       SET is_read = true
       WHERE id = $1
       RETURNING *`,
      [messageId]
    );
    
    if (result.rowCount === 0) {
      return ctx.reply('Сообщение не найдено или уже отмечено как прочитанное.');
    }
    
    // Отправляем подтверждение
    await ctx.reply(`✅ Сообщение #${messageId} отмечено как прочитанное.`);
    
    logger.info(`Admin ${ctx.from.id} marked support message ${messageId} as read`);
  } catch (error) {
    logger.error('Error in mark as read handler:', error);
    await ctx.reply('Произошла ошибка при отметке сообщения как прочитанного. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  adminCommand,
  handleAdminUserStats,
  handleAdminCheckExpired,
  handleAdminExpiringSoon,
  adminSupportCommand,
  handleMarkAsRead
}; 