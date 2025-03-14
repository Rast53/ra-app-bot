const { Markup } = require('telegraf');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

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
    
    // Формируем сообщение для администраторов
    const adminMessage = `
📩 *Новое сообщение в поддержку*

*От:* ${first_name} ${last_name || ''} (${username ? '@' + username : 'без имени'})
*ID:* ${id}
*Время:* ${new Date().toLocaleString('ru-RU')}

*Сообщение:*
${message}
`;
    
    // Отправляем сообщение администраторам
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];
    
    if (adminIds.length > 0) {
      for (const adminId of adminIds) {
        try {
          await ctx.telegram.sendMessage(adminId, adminMessage, { parse_mode: 'Markdown' });
        } catch (adminError) {
          logger.error(`Error sending support message to admin ${adminId}:`, adminError);
        }
      }
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

module.exports = {
  supportCommand,
  handleWriteSupportMessage,
  handleSupportMessage
}; 