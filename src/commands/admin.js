const { Markup } = require('telegraf');
const { getUserStats, getAllUsers } = require('../services/user');
const { checkExpiredSubscriptions, getExpiringSubscriptions } = require('../services/subscription');
const { setupLogger } = require('../utils/logger');
const { query } = require('../services/database');
const { getSupportChatStats } = require('../handlers/support-chat');

const logger = setupLogger();

// Список ID администраторов
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);

/**
 * Проверка, является ли пользователь администратором
 * @param {number} userId - ID пользователя в Telegram
 * @returns {boolean} Результат проверки
 */
function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

/**
 * Обработчик команды /admin
 * @param {Object} ctx - Контекст Telegram
 */
async function adminCommand(ctx) {
  try {
    const userId = ctx.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
      logger.info(`User ${userId} tried to access admin command but is not an admin`);
      return ctx.reply('У вас нет доступа к этой команде.');
    }
    
    // Формируем клавиатуру с действиями администратора
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Просмотр сообщений поддержки', 'admin_support')],
      [Markup.button.callback('Пользователи поддержки', 'admin_support_users')],
      [Markup.button.callback('Статистика поддержки', 'admin_support_stats')],
      [Markup.button.callback('Логи чата поддержки', 'admin_support_logs')],
      [Markup.button.callback('Статистика пользователей', 'admin_user_stats')]
    ]);
    
    // Отправляем сообщение с клавиатурой
    await ctx.reply('Выберите действие:', keyboard);
    
    logger.info(`Admin ${userId} accessed admin panel`);
  } catch (error) {
    logger.error('Error in admin command:', error);
    await ctx.reply('Произошла ошибка при выполнении команды. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик получения статистики пользователей
 * @param {Object} ctx - Контекст Telegram
 */
async function handleUserStats(ctx) {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
      logger.info(`User ${userId} tried to access user stats but is not an admin`);
      return ctx.reply('У вас нет доступа к этой функции.');
    }
    
    // Получаем статистику пользователей
    const totalUsersResult = await query(
      `SELECT COUNT(*) as count FROM users`
    );
    
    const activeSubscriptionsResult = await query(
      `SELECT COUNT(*) as count FROM user_subscriptions WHERE is_active = true`
    );
    
    const newUsersResult = await query(
      `SELECT COUNT(*) as count FROM users WHERE registration_date >= NOW() - INTERVAL '7 days'`
    );
    
    const subscriptionStatsResult = await query(
      `SELECT sp.name, COUNT(us.id) as count
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.is_active = true
       GROUP BY sp.name
       ORDER BY count DESC`
    );
    
    // Формируем сообщение со статистикой (без Markdown)
    let message = 'Статистика пользователей\n\n';
    message += `- Всего пользователей: ${totalUsersResult.rows[0].count}\n`;
    message += `- Активных подписок: ${activeSubscriptionsResult.rows[0].count}\n`;
    message += `- Новых пользователей за 7 дней: ${newUsersResult.rows[0].count}\n\n`;
    
    // Статистика по подпискам
    if (subscriptionStatsResult.rows.length > 0) {
      message += 'Распределение по подпискам:\n';
      subscriptionStatsResult.rows.forEach(row => {
        message += `- ${row.name}: ${row.count}\n`;
      });
    }
    
    // Отправляем сообщение со статистикой (без Markdown)
    await ctx.reply(message);
    
    logger.info(`Admin ${userId} viewed user statistics`);
  } catch (error) {
    logger.error('Error in user stats handler:', error);
    await ctx.reply('Произошла ошибка при получении статистики пользователей. Пожалуйста, попробуйте позже.');
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
    
    // Формируем сообщение со статистикой (без Markdown)
    let message = `Статистика пользователей\n\n`;
    message += `Всего пользователей: ${users.length}\n`;
    message += `Последние 5 пользователей:\n`;
    
    // Добавляем информацию о последних 5 пользователях
    const lastUsers = users.slice(0, 5);
    
    for (const user of lastUsers) {
      const registrationDate = user.registration_date ? 
        new Date(user.registration_date).toLocaleDateString('ru-RU') : 
        'Дата не указана';
      
      const username = user.username || 'нет';
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || user.full_name || 'Имя не указано';
      
      message += `• ${fullName} (@${username}) - ${registrationDate}\n`;
    }
    
    // Отправляем сообщение со статистикой (без Markdown)
    await ctx.reply(message);
    
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
 * Обработчик просмотра сообщений поддержки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleAdminSupport(ctx) {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
      logger.info(`User ${userId} tried to access admin support but is not an admin`);
      return ctx.reply('У вас нет доступа к этой функции.');
    }
    
    // Получаем непрочитанные сообщения из базы данных
    const result = await query(
      `SELECT sm.id, sm.telegram_id, sm.message, sm.created_at, u.username, u.telegram_username
       FROM support_messages sm
       JOIN users u ON sm.user_id = u.id
       WHERE sm.is_read = false
       ORDER BY sm.created_at ASC
       LIMIT 10`
    );
    
    if (result.rows.length === 0) {
      return ctx.reply('Нет непрочитанных сообщений в поддержке.');
    }
    
    // Отправляем каждое сообщение отдельно
    for (const row of result.rows) {
      const { id, telegram_id, message, created_at, username, telegram_username } = row;
      
      const formattedDate = new Date(created_at).toLocaleString('ru-RU');
      const userInfo = telegram_username ? 
        `${username || 'Пользователь'} (@${telegram_username})` : 
        (username || 'Пользователь без имени');
      
      const messageText = `
Сообщение #${id}
От: ${userInfo}
ID: ${telegram_id}
Дата: ${formattedDate}

Сообщение:
${message}
`;
      
      // Создаем клавиатуру с действиями
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('Отметить как прочитанное', `mark_read:${id}`),
          Markup.button.callback('Ответить', `admin_reply:${telegram_id}:${id}`)
        ],
        [
          Markup.button.callback('Просмотреть диалог', `view_dialog:${telegram_id}`)
        ]
      ]);
      
      // Отправляем сообщение с клавиатурой
      await ctx.reply(messageText, keyboard);
    }
    
    logger.info(`Admin ${userId} viewed support messages`);
  } catch (error) {
    logger.error('Error in admin support handler:', error);
    await ctx.reply('Произошла ошибка при получении сообщений поддержки. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик отметки сообщения как прочитанного
 * @param {Object} ctx - Контекст Telegram
 */
async function handleMarkRead(ctx) {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
      logger.info(`User ${userId} tried to mark message as read but is not an admin`);
      return;
    }
    
    // Получаем ID сообщения из callback_data
    const messageId = parseInt(ctx.callbackQuery.data.split(':')[1]);
    
    // Обновляем статус сообщения в базе данных
    await query(
      `UPDATE support_messages
       SET is_read = true
       WHERE id = $1`,
      [messageId]
    );
    
    // Получаем текущий текст сообщения
    const currentText = ctx.callbackQuery.message.text;
    
    // Добавляем пометку к сообщению
    await ctx.editMessageText(
      currentText + '\n\n✅ Отмечено как прочитанное'
    );
    
    // Удаляем клавиатуру
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    
    logger.info(`Admin ${userId} marked support message ${messageId} as read`);
  } catch (error) {
    logger.error('Error in mark read handler:', error);
    await ctx.reply('Произошла ошибка при обновлении статуса сообщения. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик начала ответа на сообщение
 * @param {Object} ctx - Контекст Telegram
 */
async function handleAdminReplyStart(ctx) {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
      logger.info(`User ${userId} tried to reply to message but is not an admin`);
      return;
    }
    
    // Получаем данные из callback_data
    const parts = ctx.callbackQuery.data.split(':');
    const telegramId = parseInt(parts[1]);
    const messageId = parseInt(parts[2]);
    
    // Инициализируем объект поддержки в сессии, если его нет
    if (!ctx.session.support) {
      ctx.session.support = {};
    }
    
    // Сохраняем данные в сессии
    ctx.session.support.currentAction = 'replying_to_support';
    ctx.session.support.replyToUserId = telegramId;
    ctx.session.support.replyToMessageId = messageId;
    
    // Отправляем сообщение с инструкцией
    await ctx.reply(
      `Пожалуйста, напишите ваш ответ пользователю с ID ${telegramId}. ` +
      'Ответ будет отправлен пользователю напрямую.',
      Markup.forceReply()
    );
    
    logger.info(`Admin ${userId} started replying to user ${telegramId}`);
  } catch (error) {
    logger.error('Error in admin reply start handler:', error);
    await ctx.reply('Произошла ошибка при подготовке ответа. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик получения статистики поддержки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleSupportStats(ctx) {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
      logger.info(`User ${userId} tried to access support stats but is not an admin`);
      return ctx.reply('У вас нет доступа к этой функции.');
    }
    
    // Получаем статистику за разные периоды
    const stats7Days = await getSupportChatStats(7);
    const stats30Days = await getSupportChatStats(30);
    
    // Формируем сообщение со статистикой (без Markdown)
    let message = 'Статистика сообщений поддержки\n\n';
    
    // Статистика за 7 дней
    message += `За последние ${stats7Days.period}:\n`;
    message += `- Всего сообщений: ${stats7Days.stats.total_messages || 0}\n`;
    message += `- Ответов: ${stats7Days.stats.replies || 0}\n`;
    message += `- Активных администраторов: ${stats7Days.stats.active_admins || 0}\n\n`;
    
    // Статистика за 30 дней
    message += `За последние ${stats30Days.period}:\n`;
    message += `- Всего сообщений: ${stats30Days.stats.total_messages || 0}\n`;
    message += `- Ответов: ${stats30Days.stats.replies || 0}\n`;
    message += `- Активных администраторов: ${stats30Days.stats.active_admins || 0}\n\n`;
    
    // Статистика по администраторам за 7 дней
    if (stats7Days.adminStats.length > 0) {
      message += 'Активность администраторов (7 дней):\n';
      stats7Days.adminStats.forEach(admin => {
        message += `- ${admin.admin_username}: ${admin.messages} сообщений, ${admin.replies} ответов\n`;
      });
    }
    
    // Отправляем сообщение со статистикой (без Markdown)
    await ctx.reply(message);
    
    // Получаем статистику по непрочитанным сообщениям
    const unreadResult = await query(
      `SELECT COUNT(*) as count
       FROM support_messages
       WHERE is_read = false`
    );
    
    const unansweredResult = await query(
      `SELECT COUNT(*) as count
       FROM support_messages
       WHERE is_answered = false`
    );
    
    // Отправляем дополнительную статистику (без Markdown)
    await ctx.reply(
      `Текущее состояние:\n` +
      `- Непрочитанных сообщений: ${unreadResult.rows[0].count}\n` +
      `- Неотвеченных сообщений: ${unansweredResult.rows[0].count}`
    );
    
    logger.info(`Admin ${userId} viewed support statistics`);
  } catch (error) {
    logger.error('Error in support stats handler:', error);
    await ctx.reply('Произошла ошибка при получении статистики поддержки. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик просмотра логов чата поддержки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleSupportLogs(ctx) {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
      logger.info(`User ${userId} tried to access support logs but is not an admin`);
      return ctx.reply('У вас нет доступа к этой функции.');
    }
    
    // Проверяем, существует ли таблица support_chat_logs
    const tableResult = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_chat_logs'
      )`
    );
    
    if (!tableResult.rows[0].exists) {
      return ctx.reply('Таблица логов чата поддержки не найдена. Логи будут доступны после первого сообщения в чате поддержки.');
    }
    
    // Получаем последние 10 сообщений из чата поддержки
    const result = await query(
      `SELECT * FROM support_chat_logs
       ORDER BY created_at DESC
       LIMIT 10`
    );
    
    if (result.rows.length === 0) {
      return ctx.reply('Нет сообщений в логах чата поддержки.');
    }
    
    // Отправляем сообщение с логами
    let message = 'Последние сообщения в чате поддержки:\n\n';
    
    for (const row of result.rows) {
      const date = new Date(row.created_at).toLocaleString('ru-RU');
      const replyStatus = row.is_reply ? '(ответ)' : '';
      
      message += `${date} - ${row.admin_username} ${replyStatus}:\n`;
      message += `${row.message}\n\n`;
    }
    
    // Отправляем сообщение с логами
    await ctx.reply(message);
    
    logger.info(`Admin ${userId} viewed support chat logs`);
  } catch (error) {
    logger.error('Error in support logs handler:', error);
    await ctx.reply('Произошла ошибка при получении логов чата поддержки. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик просмотра диалога поддержки с пользователем
 * @param {Object} ctx - Контекст Telegram
 */
async function handleViewSupportDialog(ctx) {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
      logger.info(`User ${userId} tried to access support dialog but is not an admin`);
      return ctx.reply('У вас нет доступа к этой функции.');
    }
    
    // Получаем ID пользователя из callback_data
    const telegramId = parseInt(ctx.callbackQuery.data.split(':')[1]);
    
    // Проверяем, существует ли таблица support_dialogs
    const tableResult = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_dialogs'
      )`
    );
    
    if (!tableResult.rows[0].exists) {
      return ctx.reply('Таблица диалогов поддержки не найдена.');
    }
    
    // Получаем диалог с пользователем
    const result = await query(
      `SELECT * FROM support_dialogs
       WHERE telegram_id = $1
       ORDER BY created_at ASC`,
      [telegramId]
    );
    
    if (result.rows.length === 0) {
      return ctx.reply(`Диалог с пользователем ID ${telegramId} не найден.`);
    }
    
    // Получаем информацию о пользователе
    const userResult = await query(
      `SELECT username, telegram_username FROM users
       WHERE telegram_id = $1`,
      [telegramId]
    );
    
    const username = userResult.rows.length > 0 ? 
      (userResult.rows[0].telegram_username || userResult.rows[0].username || 'Неизвестный пользователь') : 
      'Неизвестный пользователь';
    
    // Формируем сообщение с диалогом
    let message = `Диалог с пользователем ${username} (ID: ${telegramId}):\n\n`;
    
    for (const row of result.rows) {
      const date = new Date(row.created_at).toLocaleString('ru-RU');
      const sender = row.is_from_user ? 'Пользователь' : 'Поддержка';
      
      message += `[${date}] ${sender}:\n${row.message}\n\n`;
    }
    
    // Отправляем сообщение с диалогом
    await ctx.reply(message);
    
    // Создаем клавиатуру с действиями
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Ответить', `admin_reply:${telegramId}:0`)]
    ]);
    
    // Отправляем сообщение с клавиатурой
    await ctx.reply('Действия:', keyboard);
    
    logger.info(`Admin ${userId} viewed support dialog with user ${telegramId}`);
  } catch (error) {
    logger.error('Error in view support dialog handler:', error);
    await ctx.reply('Произошла ошибка при получении диалога поддержки. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик просмотра всех пользователей, которые писали в поддержку
 * @param {Object} ctx - Контекст Telegram
 */
async function handleSupportUsers(ctx) {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
      logger.info(`User ${userId} tried to access support users but is not an admin`);
      return ctx.reply('У вас нет доступа к этой функции.');
    }
    
    // Получаем список пользователей, которые писали в поддержку
    const result = await query(
      `SELECT DISTINCT sm.telegram_id, u.username, u.telegram_username, 
              COUNT(sm.id) as message_count,
              MAX(sm.created_at) as last_message
       FROM support_messages sm
       JOIN users u ON sm.user_id = u.id
       GROUP BY sm.telegram_id, u.username, u.telegram_username
       ORDER BY last_message DESC
       LIMIT 20`
    );
    
    if (result.rows.length === 0) {
      return ctx.reply('Нет пользователей, которые писали в поддержку.');
    }
    
    // Формируем сообщение со списком пользователей
    let message = 'Пользователи, которые писали в поддержку:\n\n';
    
    for (const [index, row] of result.rows.entries()) {
      const { telegram_id, username, telegram_username, message_count, last_message } = row;
      
      const userInfo = telegram_username ? 
        `${username || 'Пользователь'} (@${telegram_username})` : 
        (username || 'Пользователь без имени');
      
      const lastMessageDate = new Date(last_message).toLocaleString('ru-RU');
      
      message += `${index + 1}. ${userInfo}\n`;
      message += `   ID: ${telegram_id}\n`;
      message += `   Сообщений: ${message_count}\n`;
      message += `   Последнее: ${lastMessageDate}\n\n`;
    }
    
    // Отправляем сообщение со списком пользователей
    await ctx.reply(message);
    
    // Создаем клавиатуру с кнопками для просмотра диалогов
    const keyboard = [];
    
    for (let i = 0; i < Math.min(result.rows.length, 5); i++) {
      const row = result.rows[i];
      const userInfo = row.telegram_username || row.username || `ID: ${row.telegram_id}`;
      
      keyboard.push([
        Markup.button.callback(`Диалог с ${userInfo}`, `view_dialog:${row.telegram_id}`)
      ]);
    }
    
    // Отправляем сообщение с клавиатурой
    await ctx.reply('Выберите диалог для просмотра:', Markup.inlineKeyboard(keyboard));
    
    logger.info(`Admin ${userId} viewed support users`);
  } catch (error) {
    logger.error('Error in support users handler:', error);
    await ctx.reply('Произошла ошибка при получении списка пользователей. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  adminCommand,
  handleAdminUserStats,
  handleAdminCheckExpired,
  handleAdminExpiringSoon,
  handleAdminSupport,
  handleMarkRead,
  handleAdminReplyStart,
  handleSupportStats,
  handleUserStats,
  isAdmin,
  ADMIN_IDS,
  handleSupportLogs,
  handleViewSupportDialog,
  handleSupportUsers
}; 