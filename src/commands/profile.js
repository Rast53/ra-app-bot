const { Markup } = require('telegraf');
const { getUserSubscription, cancelSubscription } = require('../services/subscription');
const { getUser } = require('../services/user');
const { setupLogger } = require('../utils/logger');
const { getSubscriptionPlan } = require('../services/api');

const logger = setupLogger();

/**
 * Обработчик команды /profile
 * @param {Object} ctx - Контекст Telegram
 */
async function profileCommand(ctx) {
  try {
    const telegramId = ctx.from.id;
    
    // Получаем информацию о пользователе
    const user = await getUser(telegramId);
    
    if (!user) {
      return ctx.reply('Не удалось получить информацию о вашем профиле. Пожалуйста, попробуйте позже.');
    }
    
    // Получаем информацию о подписке
    const subscription = await getUserSubscription(telegramId);
    
    // Формируем сообщение с информацией о профиле
    let message = `
*Ваш профиль:*

*ID:* ${user.telegram_id}
*Имя:* ${user.full_name ? user.full_name.split(' ')[0] : 'Не указано'}
*Фамилия:* ${user.full_name && user.full_name.split(' ').length > 1 ? user.full_name.split(' ')[1] : 'Не указана'}
*Имя пользователя:* ${user.telegram_username ? '@' + user.telegram_username.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1') : 'Не указано'}
*Дата регистрации:* ${user.registration_date && !isNaN(new Date(user.registration_date)) ? new Date(user.registration_date).toLocaleDateString('ru-RU') : 'Не указана'}
`;
    
    // Добавляем информацию о подписке, если она есть
    if (subscription && ctx.state.hasActiveSubscription) {
      const endDate = subscription.end_date && !isNaN(new Date(subscription.end_date)) 
        ? new Date(subscription.end_date).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        : 'Не указана';
      
      // Получаем информацию о плане подписки
      let planName = 'Неизвестный план';
      try {
        const plan = await getSubscriptionPlan(subscription.plan_id);
        if (plan && plan.name) {
          planName = plan.name;
        }
      } catch (error) {
        logger.error(`Error getting plan info for plan ${subscription.plan_id}:`, error);
      }
      
      message += `
*Информация о подписке:*

*План:* ${planName}
*Статус:* Активна
*Дата окончания:* ${endDate}
`;
      
      // Создаем клавиатуру с действиями для подписки
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Отменить подписку', 'cancel_active_subscription')],
        [Markup.button.callback('Получить чек', 'get_receipt')]
      ]);
      
      // Отправляем сообщение с информацией о профиле и клавиатурой
      await ctx.replyWithMarkdown(message, keyboard);
    } else {
      message += `
*Информация о подписке:*

У вас нет активной подписки.
`;
      
      // Создаем клавиатуру с действием для оформления подписки
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('Оформить подписку', 'subscribe')
      ]);
      
      // Отправляем сообщение с информацией о профиле и клавиатурой
      await ctx.replyWithMarkdown(message, keyboard);
    }
    
    logger.info(`User ${ctx.from.id} viewed profile`);
  } catch (error) {
    logger.error('Error in profile command:', error);
    await ctx.reply('Произошла ошибка при получении информации о профиле. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик отмены активной подписки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleCancelActiveSubscription(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Отправляем сообщение с подтверждением
    await ctx.reply(
      'Вы уверены, что хотите отменить текущую подписку? После отмены вы потеряете доступ к сервису.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Да, отменить', 'confirm_cancel_subscription'),
          Markup.button.callback('Нет, оставить', 'cancel_operation')
        ]
      ])
    );
    
    // Сохраняем текущее действие в сессии
    ctx.session.user.currentAction = 'canceling_subscription';
    
    logger.info(`User ${ctx.from.id} requested to cancel subscription`);
  } catch (error) {
    logger.error('Error in cancel active subscription handler:', error);
    await ctx.reply('Произошла ошибка при отмене подписки. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик подтверждения отмены подписки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleConfirmCancelSubscription(ctx) {
  try {
    await ctx.answerCbQuery();
    
    const telegramId = ctx.from.id;
    
    // Отменяем подписку
    const result = await cancelSubscription(telegramId);
    
    if (result) {
      await ctx.reply('Ваша подписка успешно отменена. Вы можете оформить новую подписку в любое время.');
    } else {
      await ctx.reply('Не удалось отменить подписку. Возможно, у вас нет активной подписки.');
    }
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} canceled subscription`);
  } catch (error) {
    logger.error('Error in confirm cancel subscription handler:', error);
    await ctx.reply('Произошла ошибка при отмене подписки. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик отмены операции
 * @param {Object} ctx - Контекст Telegram
 */
async function handleCancelOperation(ctx) {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Операция отменена.');
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} canceled operation`);
  } catch (error) {
    logger.error('Error in cancel operation handler:', error);
    await ctx.reply('Произошла ошибка при отмене операции. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  profileCommand,
  handleCancelActiveSubscription,
  handleConfirmCancelSubscription,
  handleCancelOperation
}; 