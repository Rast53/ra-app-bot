const { setupLogger } = require('../utils/logger');
const { handleSupportReply, SUPPORT_CHAT_ID } = require('../commands/support');
const { query } = require('../services/database');
const { Markup } = require('telegraf');
const { isAdmin } = require('../utils/admin-utils');

const logger = setupLogger();

/**
 * Сохранение сообщения из чата поддержки в базу данных
 * @param {Object} ctx - Контекст Telegram
 * @param {boolean} isReply - Является ли сообщение ответом
 */
async function logSupportChatMessage(ctx, isReply) {
  try {
    // Проверяем, существует ли таблица support_chat_logs
    const tableResult = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_chat_logs'
      )`
    );
    
    // Если таблица не существует, создаем ее
    if (!tableResult.rows[0].exists) {
      await query(`
        CREATE TABLE support_chat_logs (
          id SERIAL PRIMARY KEY,
          admin_id BIGINT NOT NULL,
          admin_username TEXT,
          message TEXT NOT NULL,
          is_reply BOOLEAN NOT NULL DEFAULT FALSE,
          reply_to_message_id BIGINT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      logger.info('Created support_chat_logs table');
    }
    
    // Сохраняем сообщение в базе данных
    await query(
      `INSERT INTO support_chat_logs 
       (admin_id, admin_username, message, is_reply, reply_to_message_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        ctx.from.id, 
        ctx.from.username || `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim(), 
        ctx.message.text,
        isReply,
        ctx.message.reply_to_message ? ctx.message.reply_to_message.message_id : null
      ]
    );
    
    logger.info(`Support chat message from admin ${ctx.from.id} logged to database`);
  } catch (error) {
    logger.error('Error logging support chat message to database:', error);
  }
}

/**
 * Добавление кнопки администратора в чат поддержки
 * @param {Object} ctx - Контекст Telegram
 * @param {boolean} forceAdd - Принудительно добавить кнопку, даже если сообщение не от администратора
 */
async function addAdminButtonToSupportChat(ctx, forceAdd = false) {
  try {
    // Проверяем, является ли пользователь администратором или установлен флаг принудительного добавления
    if (forceAdd || isAdmin(ctx.from.id)) {
      // Создаем клавиатуру с кнопкой администратора
      const keyboard = {
        keyboard: [
          ['Панель администратора']
        ],
        resize_keyboard: true,
        persistent: true,
        is_persistent: true
      };
      
      // Отправляем сообщение с клавиатурой
      await ctx.reply('Доступные действия:', { reply_markup: keyboard });
      
      logger.info(`Admin button added to support chat for admin ${ctx.from.id}`);
    }
  } catch (error) {
    logger.error('Error adding admin button to support chat:', error);
  }
}

/**
 * Отправка приветственного сообщения с кнопкой администратора в чат поддержки
 * @param {Object} bot - Экземпляр Telegraf бота
 */
async function sendWelcomeMessageToSupportChat(bot) {
  try {
    // Создаем клавиатуру с кнопкой администратора
    const keyboard = {
      keyboard: [
        ['Панель администратора']
      ],
      resize_keyboard: true,
      persistent: true,
      is_persistent: true
    };
    
    // Отправляем приветственное сообщение с клавиатурой
    await bot.telegram.sendMessage(
      SUPPORT_CHAT_ID,
      'Бот запущен! Используйте кнопку ниже для доступа к панели администратора:',
      { reply_markup: keyboard }
    );
    
    logger.info('Welcome message with admin button sent to support chat');
  } catch (error) {
    logger.error('Error sending welcome message to support chat:', error);
  }
}

/**
 * Обработчик кнопки администратора
 * @param {Object} ctx - Контекст Telegram
 */
async function handleAdminPanelButton(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(ctx.from.id)) {
      logger.info(`User ${ctx.from.id} tried to access admin panel but is not an admin`);
      return ctx.reply('У вас нет доступа к этой функции.');
    }
    
    // Создаем клавиатуру с действиями администратора
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Просмотр сообщений поддержки', 'admin_support')],
      [Markup.button.callback('Пользователи поддержки', 'admin_support_users')],
      [Markup.button.callback('Статистика поддержки', 'admin_support_stats')],
      [Markup.button.callback('Логи чата поддержки', 'admin_support_logs')],
      [Markup.button.callback('Статистика пользователей', 'admin_user_stats')]
    ]);
    
    // Отправляем сообщение с клавиатурой
    await ctx.reply('Выберите действие:', keyboard);
    
    logger.info(`Admin ${ctx.from.id} accessed admin panel from support chat`);
  } catch (error) {
    logger.error('Error in admin panel button handler:', error);
    await ctx.reply('Произошла ошибка при выполнении команды. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Принудительное отображение клавиатуры администратора в чате поддержки
 * @param {Object} bot - Экземпляр Telegraf бота
 */
async function forceShowAdminKeyboard(bot) {
  try {
    // Создаем клавиатуру с кнопкой администратора
    const keyboard = {
      keyboard: [
        ['Панель администратора']
      ],
      resize_keyboard: true,
      persistent: true,
      is_persistent: true
    };
    
    // Отправляем команду для отображения клавиатуры
    await bot.telegram.sendChatAction(SUPPORT_CHAT_ID, 'typing');
    
    // Отправляем сообщение с клавиатурой
    await bot.telegram.sendMessage(
      SUPPORT_CHAT_ID,
      'Клавиатура администратора активирована. Используйте кнопку ниже для доступа к панели администратора:',
      { reply_markup: keyboard }
    );
    
    logger.info('Admin keyboard forcefully shown in support chat');
  } catch (error) {
    logger.error('Error forcing admin keyboard in support chat:', error);
  }
}

/**
 * Настройка обработчиков для чата поддержки
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupSupportChatHandlers(bot) {
  // Отправляем приветственное сообщение с кнопкой администратора при запуске бота
  sendWelcomeMessageToSupportChat(bot).catch(error => {
    logger.error('Error sending welcome message to support chat:', error);
  });
  
  // Принудительно отображаем клавиатуру администратора в чате поддержки
  forceShowAdminKeyboard(bot).catch(error => {
    logger.error('Error forcing admin keyboard in support chat:', error);
  });
  
  // Обработчик команды для принудительного отображения клавиатуры администратора
  bot.command('show_keyboard', async (ctx) => {
    try {
      // Проверяем, что команда отправлена в чат поддержки
      if (ctx.chat && ctx.chat.id === SUPPORT_CHAT_ID) {
        // Проверяем, является ли пользователь администратором
        if (!isAdmin(ctx.from.id)) {
          logger.info(`User ${ctx.from.id} tried to show admin keyboard but is not an admin`);
          return ctx.reply('У вас нет доступа к этой функции.');
        }
        
        // Создаем клавиатуру с кнопкой администратора
        const keyboard = {
          keyboard: [
            ['Панель администратора']
          ],
          resize_keyboard: true,
          persistent: true,
          is_persistent: true
        };
        
        // Отправляем сообщение с клавиатурой
        await ctx.reply('Клавиатура администратора активирована:', { reply_markup: keyboard });
        
        logger.info(`Admin ${ctx.from.id} manually activated admin keyboard`);
      }
    } catch (error) {
      logger.error('Error in show keyboard command handler:', error);
      await ctx.reply('Произошла ошибка при отображении клавиатуры. Пожалуйста, попробуйте позже.');
    }
  });
  
  // Обработчик кнопки администратора
  bot.action('admin_panel', handleAdminPanelButton);
  
  // Обработчик текстовой кнопки "Панель администратора"
  bot.hears('Панель администратора', async (ctx) => {
    try {
      // Проверяем, что сообщение отправлено в чат поддержки
      if (ctx.chat && ctx.chat.id === SUPPORT_CHAT_ID) {
        // Проверяем, является ли пользователь администратором
        if (!isAdmin(ctx.from.id)) {
          logger.info(`User ${ctx.from.id} tried to access admin panel but is not an admin`);
          return ctx.reply('У вас нет доступа к этой функции.');
        }
        
        // Создаем клавиатуру с действиями администратора
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('Просмотр сообщений поддержки', 'admin_support')],
          [Markup.button.callback('Пользователи поддержки', 'admin_support_users')],
          [Markup.button.callback('Статистика поддержки', 'admin_support_stats')],
          [Markup.button.callback('Логи чата поддержки', 'admin_support_logs')],
          [Markup.button.callback('Статистика пользователей', 'admin_user_stats')]
        ]);
        
        // Отправляем сообщение с клавиатурой
        await ctx.reply('Выберите действие:', keyboard);
        
        logger.info(`Admin ${ctx.from.id} accessed admin panel from support chat`);
      }
    } catch (error) {
      logger.error('Error in admin panel button handler:', error);
      await ctx.reply('Произошла ошибка при выполнении команды. Пожалуйста, попробуйте позже.');
    }
  });
  
  // Обработчик всех текстовых сообщений в чате поддержки
  bot.on('text', async (ctx, next) => {
    try {
      // Проверяем, что сообщение отправлено в чат поддержки
      if (ctx.chat && ctx.chat.id === SUPPORT_CHAT_ID) {
        logger.info(`Message in support chat from user ${ctx.from.id}: ${ctx.message.text.substring(0, 100)}${ctx.message.text.length > 100 ? '...' : ''}`);
        
        // Если это ответ на сообщение
        if (ctx.message.reply_to_message) {
          // Проверяем, что это ответ на сообщение от бота
          if (ctx.message.reply_to_message.from && ctx.message.reply_to_message.from.id === ctx.botInfo.id) {
            logger.info(`Processing reply to bot message in support chat: ${ctx.message.text.substring(0, 100)}${ctx.message.text.length > 100 ? '...' : ''}`);
            
            // Логируем сообщение в базу данных
            await logSupportChatMessage(ctx, true);
            
            // Обрабатываем ответ
            await handleSupportReply(ctx);
            return;
          }
        }
        
        // Логируем обычное сообщение в чате поддержки
        await logSupportChatMessage(ctx, false);
      }
      
      // Если это не сообщение в чате поддержки или не ответ, передаем управление следующему обработчику
      return next();
    } catch (error) {
      logger.error('Error in support chat handler:', error);
      return next();
    }
  });
  
  // Обработчик всех медиа-сообщений в чате поддержки
  const mediaTypes = ['photo', 'video', 'document', 'audio', 'voice', 'sticker'];
  
  mediaTypes.forEach(mediaType => {
    bot.on(mediaType, async (ctx, next) => {
      try {
        // Проверяем, что сообщение отправлено в чат поддержки
        if (ctx.chat && ctx.chat.id === SUPPORT_CHAT_ID) {
          logger.info(`Media message (${mediaType}) in support chat from user ${ctx.from.id}`);
          
          // Если это ответ на сообщение от бота, обрабатываем как ответ
          if (ctx.message.reply_to_message && 
              ctx.message.reply_to_message.from && 
              ctx.message.reply_to_message.from.id === ctx.botInfo.id) {
            
            // Отправляем уведомление, что медиа-ответы не поддерживаются
            await ctx.reply(
              'Внимание! Ответы с медиа-файлами не поддерживаются. Пожалуйста, используйте только текстовые сообщения для ответов пользователям.',
              { reply_to_message_id: ctx.message.message_id }
            );
          }
        }
        
        return next();
      } catch (error) {
        logger.error(`Error in support chat ${mediaType} handler:`, error);
        return next();
      }
    });
  });
  
  logger.info('Support chat handlers set up successfully');
  
  return bot;
}

/**
 * Получение статистики по сообщениям в чате поддержки
 * @param {number} days - Количество дней для выборки
 * @returns {Promise<Object>} Статистика сообщений
 */
async function getSupportChatStats(days = 7) {
  try {
    // Проверяем, существует ли таблица support_chat_logs
    const tableResult = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_chat_logs'
      )`
    );
    
    if (!tableResult.rows[0].exists) {
      return {
        period: `${days} дней`,
        stats: { total_messages: 0, replies: 0, active_admins: 0 },
        adminStats: []
      };
    }
    
    const stats = await query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN is_reply = true THEN 1 END) as replies,
        COUNT(DISTINCT admin_id) as active_admins
      FROM support_chat_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `);
    
    const adminStats = await query(`
      SELECT 
        admin_username,
        COUNT(*) as messages,
        COUNT(CASE WHEN is_reply = true THEN 1 END) as replies
      FROM support_chat_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY admin_username
      ORDER BY messages DESC
    `);
    
    return {
      period: `${days} дней`,
      stats: stats.rows[0],
      adminStats: adminStats.rows
    };
  } catch (error) {
    logger.error('Error getting support chat stats:', error);
    return {
      period: `${days} дней`,
      stats: { total_messages: 0, replies: 0, active_admins: 0 },
      adminStats: []
    };
  }
}

module.exports = {
  setupSupportChatHandlers,
  getSupportChatStats,
  handleAdminPanelButton,
  sendWelcomeMessageToSupportChat,
  forceShowAdminKeyboard
}; 