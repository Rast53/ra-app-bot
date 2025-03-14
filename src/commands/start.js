const { Markup } = require('telegraf');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Обработчик команды /start
 * @param {Object} ctx - Контекст Telegram
 */
async function startCommand(ctx) {
  try {
    const { first_name } = ctx.from;
    
    // Приветственное сообщение
    const welcomeMessage = `
Привет, ${first_name}! 👋

Добро пожаловать в бот для управления подпиской на сервис.

С помощью этого бота вы можете:
• Оформить подписку на сервис
• Управлять своей подпиской
• Получать уведомления о статусе подписки
• Получать чеки за оплату

Используйте команду /help, чтобы узнать больше о доступных командах.
`;
    
    // Создаем клавиатуру с основными командами
    const keyboard = Markup.keyboard([
      ['💳 Подписка', '👤 Профиль'],
      ['ℹ️ Помощь', '📞 Поддержка']
    ]).resize();
    
    // Отправляем приветственное сообщение с клавиатурой
    await ctx.reply(welcomeMessage, keyboard);
    
    // Если пользователь новый, предлагаем ему оформить подписку
    if (!ctx.state.hasActiveSubscription) {
      setTimeout(async () => {
        await ctx.reply(
          'У вас еще нет активной подписки. Хотите оформить подписку прямо сейчас?',
          Markup.inlineKeyboard([
            Markup.button.callback('Оформить подписку', 'subscribe'),
            Markup.button.callback('Узнать больше', 'more_info')
          ])
        );
      }, 1000);
    }
    
    logger.info(`User ${ctx.from.id} started the bot`);
  } catch (error) {
    logger.error('Error in start command:', error);
    await ctx.reply('Произошла ошибка при запуске бота. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  startCommand
}; 