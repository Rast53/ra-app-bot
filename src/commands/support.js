const { Markup } = require('telegraf');
const { setupLogger } = require('../utils/logger');
const { query } = require('../services/database');

const logger = setupLogger();

// ID группы поддержки (обновлен после миграции в супергруппу)
const SUPPORT_CHAT_ID = process.env.SUPPORT_CHAT_ID;

/**
 * Экранирование специальных символов Markdown
 * @param {string} text - Текст для экранирования
 * @returns {string} Экранированный текст
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
}

/**
 * Обработчик команды /support
 * @param {Object} ctx - Контекст Telegram
 */
async function supportCommand(ctx) {
  try {
    // Формируем сообщение с информацией о поддержке
    const message = `
Если у вас возникли вопросы или проблемы, вы можете связаться с нашей поддержкой:

*Email:* ${process.env.SUPPORT_EMAIL || 'support@example.com'}
*Телефон:* ${process.env.SUPPORT_PHONE || '+7 (XXX) XXX-XX-XX'}

Также вы можете отправить сообщение прямо здесь, и мы ответим вам в ближайшее время.
`;
    
    // Создаем клавиатуру с действиями
    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('Написать сообщение', 'write_support_message')
    ]);
    
    // Отправляем сообщение с информацией о поддержке и клавиатурой
    await ctx.replyWithMarkdown(message, keyboard);
    
    logger.info(`User ${ctx.from.id} requested support info`);
  } catch (error) {
    logger.error('Error in support command:', error);
    await ctx.reply('Произошла ошибка при получении информации о поддержке. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик написания сообщения в поддержку
 * @param {Object} ctx - Контекст Telegram
 */
async function handleWriteSupportMessage(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Отправляем сообщение с инструкцией
    await ctx.reply(
      'Пожалуйста, напишите ваше сообщение для службы поддержки. ' +
      'Опишите вашу проблему или вопрос как можно подробнее.',
      Markup.forceReply()
    );
    
    // Сохраняем текущее действие в сессии
    ctx.session.user.currentAction = 'writing_support_message';
    
    logger.info(`User ${ctx.from.id} started writing support message`);
  } catch (error) {
    logger.error('Error in write support message handler:', error);
    await ctx.reply('Произошла ошибка при отправке сообщения в поддержку. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик сообщения для поддержки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleSupportMessage(ctx) {
  try {
    // Проверяем, что пользователь находится в режиме написания сообщения в поддержку
    if (ctx.session.user.currentAction !== 'writing_support_message') {
      return;
    }
    
    const message = ctx.message.text;
    const { id, username, first_name, last_name } = ctx.from;
    
    // Экранируем специальные символы в данных пользователя
    const escapedFirstName = escapeMarkdown(first_name);
    const escapedLastName = escapeMarkdown(last_name || '');
    const escapedUsername = username ? '@' + escapeMarkdown(username) : 'без имени';
    const escapedMessage = escapeMarkdown(message);
    
    // Формируем сообщение для группы поддержки
    const supportMessage = `
📩 *Новое сообщение в поддержку*

*От:* ${escapedFirstName} ${escapedLastName} (${escapedUsername})
*ID:* ${id}
*Время:* ${new Date().toLocaleString('ru-RU')}

*Сообщение:*
${escapedMessage}
`;
    
    // Отправляем сообщение в группу поддержки с кнопкой ответа
    try {
      const sentMessage = await ctx.telegram.sendMessage(
        SUPPORT_CHAT_ID, 
        supportMessage, 
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Ответить', callback_data: `reply_to_user:${id}` }]
            ]
          }
        }
      );
      
      // Сохраняем информацию о диалоге в базе данных
      await saveSupportDialog(id, message, sentMessage.message_id);
      
      logger.info(`Support message from user ${id} sent to support chat`);
    } catch (error) {
      logger.error(`Error sending message to support chat:`, error);
      
      // Проверяем, была ли ошибка связана с миграцией чата
      if (error.response && error.response.parameters && error.response.parameters.migrate_to_chat_id) {
        const newChatId = error.response.parameters.migrate_to_chat_id;
        logger.info(`Support chat migrated to new ID: ${newChatId}. Please update SUPPORT_CHAT_ID in the code.`);
        
        // Пробуем отправить сообщение в новый чат
        try {
          const sentMessage = await ctx.telegram.sendMessage(
            newChatId, 
            supportMessage, 
            { 
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Ответить', callback_data: `reply_to_user:${id}` }]
                ]
              }
            }
          );
          
          // Сохраняем информацию о диалоге в базе данных
          await saveSupportDialog(id, message, sentMessage.message_id);
          
          logger.info(`Support message from user ${id} sent to new support chat ID: ${newChatId}`);
          return; // Выходим из функции, так как сообщение успешно отправлено
        } catch (newError) {
          logger.error(`Error sending message to new support chat:`, newError);
        }
      }
      
      // Если не удалось отправить сообщение в группу поддержки, сохраняем его в базе данных
      await saveSupportMessage(id, message);
      
      logger.info(`Support message from user ${id} saved to database only`);
    }
    
    // Отправляем подтверждение пользователю
    await ctx.reply(
      'Спасибо! Ваше сообщение отправлено в службу поддержки. Мы ответим вам в ближайшее время.'
    );
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} sent support message`);
  } catch (error) {
    logger.error('Error in support message handler:', error);
    await ctx.reply('Произошла ошибка при отправке сообщения в поддержку. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Сохранение информации о диалоге поддержки в базе данных
 * @param {number} userId - ID пользователя в Telegram
 * @param {string} message - Сообщение пользователя
 * @param {number} supportMessageId - ID сообщения в чате поддержки
 */
async function saveSupportDialog(userId, message, supportMessageId) {
  try {
    // Получаем ID пользователя из базы данных
    const userResult = await query(
      'SELECT id FROM users WHERE CAST(telegram_id AS TEXT) = $1',
      [String(userId)]
    );
    
    if (userResult.rows.length === 0) {
      logger.error(`User with telegram_id ${userId} not found in database`);
      return;
    }
    
    const dbUserId = userResult.rows[0].id;
    
    // Проверяем, существует ли таблица support_dialogs
    const tableResult = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_dialogs'
      )`
    );
    
    // Если таблица не существует, создаем ее
    if (!tableResult.rows[0].exists) {
      await query(`
        CREATE TABLE support_dialogs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          telegram_id BIGINT NOT NULL,
          message TEXT NOT NULL,
          support_message_id BIGINT,
          is_from_user BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      logger.info('Created support_dialogs table');
    }
    
    // Сохраняем сообщение в базе данных
    await query(
      `INSERT INTO support_dialogs 
       (user_id, telegram_id, message, support_message_id, is_from_user, created_at) 
       VALUES ($1, $2, $3, $4, TRUE, NOW())`,
      [dbUserId, userId, message, supportMessageId]
    );
    
    logger.info(`Support dialog for user ${userId} saved to database`);
  } catch (error) {
    logger.error('Error saving support dialog to database:', error);
  }
}

/**
 * Сохранение сообщения поддержки в базе данных (без отправки в чат поддержки)
 * @param {number} userId - ID пользователя в Telegram
 * @param {string} message - Сообщение пользователя
 */
async function saveSupportMessage(userId, message) {
  try {
    // Получаем ID пользователя из базы данных
    const userResult = await query(
      'SELECT id FROM users WHERE CAST(telegram_id AS TEXT) = $1',
      [String(userId)]
    );
    
    if (userResult.rows.length === 0) {
      logger.error(`User with telegram_id ${userId} not found in database`);
      return;
    }
    
    const dbUserId = userResult.rows[0].id;
    
    // Проверяем, существует ли таблица support_messages
    const tableResult = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_messages'
      )`
    );
    
    // Если таблица не существует, создаем ее
    if (!tableResult.rows[0].exists) {
      await query(`
        CREATE TABLE support_messages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          telegram_id BIGINT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          is_answered BOOLEAN NOT NULL DEFAULT FALSE,
          answer TEXT,
          answered_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      logger.info('Created support_messages table');
    }
    
    // Сохраняем сообщение в базе данных
    await query(
      `INSERT INTO support_messages 
       (user_id, telegram_id, message, created_at) 
       VALUES ($1, $2, $3, NOW())`,
      [dbUserId, userId, message]
    );
    
    logger.info(`Support message from user ${userId} saved to database`);
  } catch (error) {
    logger.error('Error saving support message to database:', error);
  }
}

/**
 * Обработчик начала ответа на сообщение пользователя из чата поддержки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleReplyToUserStart(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Получаем ID пользователя из callback_data
    const userId = parseInt(ctx.callbackQuery.data.split(':')[1]);
    
    // Получаем оригинальное сообщение
    const originalMessage = ctx.callbackQuery.message;
    
    // Отправляем сообщение с инструкцией и принудительным Reply
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      `Пожалуйста, напишите ваш ответ пользователю с ID ${userId}. ` +
      'Ответ будет отправлен пользователю напрямую.',
      { 
        reply_to_message_id: originalMessage.message_id,
        reply_markup: { force_reply: true }
      }
    );
    
    logger.info(`Support started replying to user ${userId} using force reply`);
  } catch (error) {
    logger.error('Error in reply to user start handler:', error);
    await ctx.reply('Произошла ошибка при подготовке ответа. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик ответа от поддержки пользователю
 * @param {Object} ctx - Контекст Telegram
 */
async function handleSupportReply(ctx) {
  try {
    // Проверяем, что сообщение отправлено в группу поддержки
    if (ctx.chat.id !== SUPPORT_CHAT_ID) {
      return;
    }
    
    // Проверяем, что это ответ на сообщение
    if (!ctx.message.reply_to_message) {
      return;
    }
    
    // Проверяем, что это ответ на сообщение от бота
    if (!ctx.message.reply_to_message.from || ctx.message.reply_to_message.from.id !== ctx.botInfo.id) {
      return;
    }
    
    // Извлекаем ID пользователя из оригинального сообщения
    const originalText = ctx.message.reply_to_message.text || '';
    
    logger.info(`Trying to extract user ID from message: "${originalText}"`);
    
    // Пробуем разные форматы извлечения ID
    let userIdMatch = originalText.match(/\*ID:\*\s*(\d+)/);
    if (!userIdMatch || !userIdMatch[1]) {
      userIdMatch = originalText.match(/ID:\s*(\d+)/);
    }
    if (!userIdMatch || !userIdMatch[1]) {
      userIdMatch = originalText.match(/От:.+ID:\s*(\d+)/);
    }
    
    // Если не удалось извлечь ID, пробуем найти его в тексте
    if (!userIdMatch || !userIdMatch[1]) {
      const idMatches = originalText.match(/\d{9,10}/g);
      if (idMatches && idMatches.length > 0) {
        userIdMatch = [null, idMatches[0]];
      }
    }
    
    if (!userIdMatch || !userIdMatch[1]) {
      logger.error(`Could not extract user ID from message: ${originalText}`);
      await ctx.reply('Не удалось определить ID пользователя из оригинального сообщения. Пожалуйста, убедитесь, что вы отвечаете на сообщение от пользователя.');
      return;
    }
    
    const userId = parseInt(userIdMatch[1]);
    const reply = ctx.message.text;
    
    // Извлекаем исходное сообщение пользователя из оригинального сообщения
    let originalUserMessage = '';
    
    // Проверяем, что это сообщение от пользователя, а не инструкция для ответа
    if (originalText.includes('📩 *Новое сообщение в поддержку*') || 
        originalText.includes('📩 *Продолжение диалога*')) {
      
      // Пробуем разные форматы извлечения сообщения
      const messageMatch1 = originalText.match(/\*Сообщение:\*\s*\n([\s\S]+)$/);
      const messageMatch2 = originalText.match(/\*Новое сообщение пользователя:\*\s*\n([\s\S]+)$/);
      
      if (messageMatch1 && messageMatch1[1]) {
        originalUserMessage = messageMatch1[1].trim();
      } else if (messageMatch2 && messageMatch2[1]) {
        originalUserMessage = messageMatch2[1].trim();
      } else {
        // Если не удалось извлечь сообщение по шаблонам, берем весь текст после последнего заголовка
        const lines = originalText.split('\n');
        let messageLines = [];
        let foundLastHeader = false;
        
        for (let i = lines.length - 1; i >= 0; i--) {
          if (!foundLastHeader && lines[i].trim() === '') continue;
          
          if (!foundLastHeader && lines[i].includes('*') && !messageLines.length) {
            foundLastHeader = true;
            continue;
          }
          
          if (foundLastHeader) {
            messageLines.unshift(lines[i]);
          }
        }
        
        if (messageLines.length > 0) {
          originalUserMessage = messageLines.join('\n').trim();
        }
      }
    } else {
      // Это может быть сообщение с инструкцией для ответа, попробуем найти ID пользователя в базе данных
      try {
        const userDialogs = await query(
          `SELECT message FROM support_dialogs 
           WHERE telegram_id = $1 AND is_from_user = true 
           ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );
        
        if (userDialogs.rows.length > 0) {
          originalUserMessage = userDialogs.rows[0].message;
        }
      } catch (dbError) {
        logger.error(`Error fetching user message from database: ${dbError}`);
      }
    }
    
    logger.info(`Extracted user ID: ${userId}, original message: "${originalUserMessage}", sending reply: "${reply}"`);
    
    // Отправляем ответ пользователю
    try {
      // Формируем сообщение с цитированием исходного сообщения
      let replyMessage = '*Ответ от службы поддержки:*\n\n';
      
      // Если удалось извлечь исходное сообщение, добавляем его в цитату
      if (originalUserMessage) {
        replyMessage += `*Ваше сообщение:*\n> ${escapeMarkdown(originalUserMessage)}\n\n`;
      } else {
        // Если не удалось извлечь сообщение, пробуем получить его из базы данных
        try {
          const userDialogs = await query(
            `SELECT message FROM support_dialogs 
             WHERE telegram_id = $1 AND is_from_user = true 
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
          );
          
          if (userDialogs.rows.length > 0) {
            replyMessage += `*Ваше сообщение:*\n> ${escapeMarkdown(userDialogs.rows[0].message)}\n\n`;
          }
        } catch (dbError) {
          logger.error(`Error fetching user message from database: ${dbError}`);
        }
      }
      
      // Добавляем ответ поддержки
      replyMessage += `*Ответ:*\n${escapeMarkdown(reply)}`;
      
      // Создаем клавиатуру с кнопкой "Ответить"
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('Ответить на это сообщение', 'write_support_message')
      ]);
      
      // Отправляем сообщение с клавиатурой
      const sentMessage = await ctx.telegram.sendMessage(
        userId,
        replyMessage,
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        }
      );
      
      // Сохраняем ответ в базе данных
      await saveSupportReply(userId, reply, ctx.message.message_id);
      
      // Отправляем подтверждение в чат поддержки
      await ctx.reply(
        `✅ Ответ успешно отправлен пользователю с ID ${userId}.`,
        { reply_to_message_id: ctx.message.message_id }
      );
      
      logger.info(`Support reply sent to user ${userId}, message_id: ${sentMessage.message_id}`);
    } catch (error) {
      logger.error(`Error sending reply to user ${userId}:`, error);
      
      // Если не удалось отправить ответ пользователю
      await ctx.reply(
        `❌ Не удалось отправить ответ пользователю с ID ${userId}. ` +
        'Возможно, пользователь заблокировал бота или указан неверный ID.',
        { reply_to_message_id: ctx.message.message_id }
      );
    }
  } catch (error) {
    logger.error('Error in support reply handler:', error);
    await ctx.reply('Произошла ошибка при отправке ответа. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Сохранение ответа поддержки в базе данных
 * @param {number} userId - ID пользователя в Telegram
 * @param {string} reply - Ответ от поддержки
 * @param {number} supportMessageId - ID сообщения в чате поддержки
 */
async function saveSupportReply(userId, reply, supportMessageId) {
  try {
    // Получаем ID пользователя из базы данных
    const userResult = await query(
      'SELECT id FROM users WHERE CAST(telegram_id AS TEXT) = $1',
      [String(userId)]
    );
    
    if (userResult.rows.length === 0) {
      logger.error(`User with telegram_id ${userId} not found in database`);
      return;
    }
    
    const dbUserId = userResult.rows[0].id;
    
    // Проверяем, существует ли таблица support_dialogs
    const tableResult = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_dialogs'
      )`
    );
    
    // Если таблица существует, сохраняем ответ в ней
    if (tableResult.rows[0].exists) {
      await query(
        `INSERT INTO support_dialogs 
         (user_id, telegram_id, message, support_message_id, is_from_user, created_at) 
         VALUES ($1, $2, $3, $4, FALSE, NOW())`,
        [dbUserId, userId, reply, supportMessageId]
      );
      
      logger.info(`Support reply to user ${userId} saved to support_dialogs`);
    }
    
    // Проверяем, существует ли таблица support_messages
    const messagesTableResult = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_messages'
      )`
    );
    
    // Если таблица существует, обновляем последнее сообщение пользователя
    if (messagesTableResult.rows[0].exists) {
      // Сначала проверяем, есть ли неотвеченные сообщения
      const unreadMessagesResult = await query(
        `SELECT id FROM support_messages
         WHERE telegram_id = $1
         AND is_answered = false
         ORDER BY created_at DESC`,
        [userId]
      );
      
      if (unreadMessagesResult.rows.length > 0) {
        // Обновляем самое последнее неотвеченное сообщение
        await query(
          `UPDATE support_messages
           SET is_read = true,
               is_answered = true,
               answer = $1,
               answered_at = NOW()
           WHERE id = $2`,
          [reply, unreadMessagesResult.rows[0].id]
        );
        
        logger.info(`Support reply to user ${userId} updated in support_messages for message ID ${unreadMessagesResult.rows[0].id}`);
      } else {
        // Если нет неотвеченных сообщений, создаем новую запись
        // Получаем последнее сообщение пользователя из support_dialogs
        const lastMessageResult = await query(
          `SELECT message FROM support_dialogs
           WHERE telegram_id = $1
           AND is_from_user = true
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId]
        );
        
        let lastMessage = '';
        if (lastMessageResult.rows.length > 0) {
          lastMessage = lastMessageResult.rows[0].message;
        }
        
        // Создаем новую запись в support_messages
        await query(
          `INSERT INTO support_messages
           (user_id, telegram_id, message, created_at, is_read, is_answered, answer, answered_at)
           VALUES ($1, $2, $3, NOW() - INTERVAL '1 minute', true, true, $4, NOW())`,
          [dbUserId, userId, lastMessage, reply]
        );
        
        logger.info(`New support message and reply created for user ${userId} in support_messages`);
      }
    }
  } catch (error) {
    logger.error('Error saving support reply to database:', error);
  }
}

/**
 * Обработчик продолжения диалога с поддержкой от пользователя
 * @param {Object} ctx - Контекст Telegram
 */
async function handleContinueSupportDialog(ctx) {
  try {
    // Проверяем, что это ответ на сообщение от бота
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.from || ctx.message.reply_to_message.from.id !== ctx.botInfo.id) {
      return false;
    }
    
    // Проверяем, что это ответ на сообщение от поддержки
    const originalText = ctx.message.reply_to_message.text || '';
    if (!originalText.startsWith('*Ответ от службы поддержки:*')) {
      return false;
    }
    
    const message = ctx.message.text;
    const { id, username, first_name, last_name } = ctx.from;
    
    // Экранируем специальные символы в данных пользователя
    const escapedFirstName = escapeMarkdown(first_name);
    const escapedLastName = escapeMarkdown(last_name || '');
    const escapedUsername = username ? '@' + escapeMarkdown(username) : 'без имени';
    const escapedMessage = escapeMarkdown(message);
    
    // Извлекаем ответ поддержки из оригинального сообщения
    let supportReply = '';
    let userOriginalMessage = '';
    
    // Извлекаем исходное сообщение пользователя
    const userMessageMatch = originalText.match(/\*Ваше сообщение:\*\s*\n>\s*([\s\S]+?)\n\n/);
    if (userMessageMatch && userMessageMatch[1]) {
      userOriginalMessage = userMessageMatch[1].trim();
    }
    
    // Извлекаем ответ поддержки
    const supportReplyMatch = originalText.match(/\*Ответ:\*\s*\n([\s\S]+)$/);
    if (supportReplyMatch && supportReplyMatch[1]) {
      supportReply = supportReplyMatch[1].trim();
    } else {
      // Если не удалось извлечь по новому формату, пробуем старый
      if (originalText.includes('> ')) {
        const parts = originalText.split('\n\n');
        if (parts.length > 2) {
          supportReply = parts[parts.length - 1].trim();
        }
      } else {
        // Иначе берем весь текст после заголовка
        const replyMatch = originalText.match(/\*Ответ от службы поддержки:\*\s*\n\n([\s\S]+)$/);
        if (replyMatch && replyMatch[1]) {
          supportReply = replyMatch[1].trim();
        }
      }
    }
    
    // Формируем сообщение для группы поддержки
    let supportMessage = `
📩 *Продолжение диалога*

*От:* ${escapedFirstName} ${escapedLastName} (${escapedUsername})
*ID:* ${id}
*Время:* ${new Date().toLocaleString('ru-RU')}
`;

    // Добавляем исходное сообщение пользователя, если оно есть
    if (userOriginalMessage) {
      supportMessage += `
*Исходное сообщение пользователя:*
${userOriginalMessage}
`;
    }

    // Добавляем предыдущий ответ поддержки
    supportMessage += `
*Предыдущий ответ поддержки:*
${supportReply ? supportReply : '(не удалось извлечь)'}

*Новое сообщение пользователя:*
${escapedMessage}
`;
    
    // Отправляем сообщение в группу поддержки с кнопкой ответа
    try {
      const sentMessage = await ctx.telegram.sendMessage(
        SUPPORT_CHAT_ID, 
        supportMessage, 
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Ответить', callback_data: `reply_to_user:${id}` }]
            ]
          }
        }
      );
      
      // Сохраняем информацию о диалоге в базе данных
      await saveSupportDialog(id, message, sentMessage.message_id);
      
      logger.info(`Continued support dialog from user ${id} sent to support chat`);
      
      // Отправляем подтверждение пользователю
      await ctx.reply('Ваше сообщение отправлено в службу поддержки. Мы ответим вам в ближайшее время.');
      
      return true;
    } catch (error) {
      logger.error(`Error sending continued dialog to support chat:`, error);
      return false;
    }
  } catch (error) {
    logger.error('Error in continue support dialog handler:', error);
    return false;
  }
}

/**
 * Обработчик ответа администратора на сообщение поддержки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleAdminReply(ctx) {
  try {
    // Получаем ID пользователя, которому отвечаем
    const userId = ctx.session.support.replyToUserId;
    const reply = ctx.message.text;
    
    if (!userId) {
      ctx.session.support.currentAction = null;
      return ctx.reply('Не удалось определить ID пользователя для ответа.');
    }
    
    // Отправляем ответ пользователю
    try {
      await ctx.telegram.sendMessage(
        userId,
        `*Ответ от службы поддержки:*\n\n${escapeMarkdown(reply)}`,
        { parse_mode: 'Markdown' }
      );
      
      // Сохраняем ответ в базе данных
      await saveSupportReply(userId, reply, ctx.message.message_id);
      
      // Отправляем подтверждение администратору
      await ctx.reply(`✅ Ответ успешно отправлен пользователю с ID ${userId}.`);
      
      // Очищаем текущее действие в сессии
      ctx.session.support.currentAction = null;
      ctx.session.support.replyToUserId = null;
      
      logger.info(`Admin ${ctx.from.id} replied to user ${userId}`);
    } catch (error) {
      logger.error(`Error sending reply to user ${userId}:`, error);
      
      // Если не удалось отправить ответ пользователю, все равно сохраняем его в базе данных
      await saveSupportReply(userId, reply, ctx.message.message_id);
      
      // Отправляем сообщение об ошибке администратору
      await ctx.reply(
        `❌ Не удалось отправить ответ пользователю с ID ${userId}. ` +
        'Возможно, пользователь заблокировал бота. ' +
        'Ответ сохранен в базе данных.'
      );
      
      // Очищаем текущее действие в сессии
      ctx.session.support.currentAction = null;
      ctx.session.support.replyToUserId = null;
    }
  } catch (error) {
    logger.error('Error in admin reply handler:', error);
    await ctx.reply('Произошла ошибка при отправке ответа. Пожалуйста, попробуйте позже.');
    
    // Очищаем текущее действие в сессии
    if (ctx.session.support) {
      ctx.session.support.currentAction = null;
      ctx.session.support.replyToUserId = null;
    }
  }
}

module.exports = {
  supportCommand,
  handleWriteSupportMessage,
  handleSupportMessage,
  handleReplyToUserStart,
  handleSupportReply,
  handleContinueSupportDialog,
  handleAdminReply,
  SUPPORT_CHAT_ID
}; 