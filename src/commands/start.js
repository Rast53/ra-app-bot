const { Markup } = require('telegraf');
const { setupLogger } = require('../utils/logger');
const { getUserSubscription } = require('../services/subscription');
const { getSubscriptionPlan } = require('../services/api');

const logger = setupLogger();

/**
 * Обработчик команды /start
 * @param {Object} ctx - Контекст Telegram
 */
async function startCommand(ctx) {
  try {
    const { first_name } = ctx.from;
    const telegramId = ctx.from.id;
    
    // Проверяем, есть ли у пользователя активная подписка
    if (ctx.state.hasActiveSubscription) {
      // Получаем информацию о подписке
      const subscription = await getUserSubscription(telegramId);
      
      if (!subscription) {
        return ctx.reply('Не удалось получить информацию о вашей подписке. Пожалуйста, попробуйте позже.');
      }
      
      // Получаем информацию о плане подписки
      const plan = await getSubscriptionPlan(subscription.plan_id);
      
      // Приветственное сообщение с информацией о подписке
      let message = `Привет, ${first_name}! 👋\n\n`;
      message += `Ваш текущий план: *${plan ? plan.name : 'Стандартный'}*\n`;
      
      if (subscription.end_date && !isNaN(new Date(subscription.end_date))) {
        const daysLeft = Math.ceil((new Date(subscription.end_date) - new Date()) / (1000 * 60 * 60 * 24));
        message += `Осталось дней: ${daysLeft > 0 ? daysLeft : 0}\n\n`;
      }
      
      message += 'Используйте меню для навигации:';
      
      // Создаем клавиатуру с основными командами
      const keyboard = Markup.keyboard([
        ['💳 Подписка', '👤 Профиль'],
        ['ℹ️ Помощь', '📞 Поддержка']
      ]).resize();
      
      ctx.replyWithMarkdown(message, keyboard);
    } else {
      // Если у пользователя нет активной подписки
      let message = `Привет, ${first_name}! 👋\n\n`;
      message += 'У вас нет активной подписки. Вы можете оформить подписку с помощью команды /subscribe.\n\n';
      message += 'Используйте меню для навигации:';
      
      // Создаем клавиатуру с основными командами
      const keyboard = Markup.keyboard([
        ['💳 Подписка', '👤 Профиль'],
        ['ℹ️ Помощь', '📞 Поддержка']
      ]).resize();
      
      ctx.replyWithMarkdown(message, keyboard);
      
      // Если пользователь новый, предлагаем ему оформить подписку
      setTimeout(async () => {
        await ctx.reply(
          'Хотите оформить подписку прямо сейчас?',
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