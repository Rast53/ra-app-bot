const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Обработчик команды /help
 * @param {Object} ctx - Контекст Telegram
 */
async function helpCommand(ctx) {
  try {
    const helpMessage = `
*Доступные команды:*

/start - Запустить бота и получить приветственное сообщение
/help - Показать список доступных команд
/subscribe - Оформить подписку
/profile - Информация о вашем профиле и подписке
/receipt - Получить чек за последнюю оплату
/cancel - Отменить текущую подписку
/support - Связаться с поддержкой

*Кнопки клавиатуры:*

💳 Подписка - Управление подпиской
👤 Профиль - Информация о вашем профиле
ℹ️ Помощь - Показать справку
📞 Поддержка - Связаться с поддержкой

Если у вас возникли вопросы или проблемы, используйте команду /support для связи с поддержкой.
`;
    
    // Отправляем сообщение с помощью
    await ctx.replyWithMarkdown(helpMessage);
    
    logger.info(`User ${ctx.from.id} requested help`);
  } catch (error) {
    logger.error('Error in help command:', error);
    await ctx.reply('Произошла ошибка при отображении справки. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  helpCommand
}; 