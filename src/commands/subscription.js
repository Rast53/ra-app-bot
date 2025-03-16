const { Markup } = require('telegraf');
const { getUserSubscription, cancelSubscription } = require('../services/subscription');
const { getSubscriptionPlans, getSubscriptionPlan, activateSubscription } = require('../services/api');
const { query } = require('../services/database');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Обработчик команды /subscription
 * @param {Object} ctx - Контекст Telegram
 */
async function subscriptionCommand(ctx) {
  try {
    const telegramId = ctx.from.id;
    
    // Проверяем, есть ли у пользователя активная подписка
    if (!ctx.state.hasActiveSubscription) {
      return ctx.reply(
        'У вас нет активной подписки. Вы можете оформить подписку с помощью команды /subscribe.',
        Markup.inlineKeyboard([
          Markup.button.callback('Оформить подписку', 'subscribe')
        ])
      );
    }
    
    // Получаем информацию о подписке
    const subscription = await getUserSubscription(telegramId);
    
    if (!subscription) {
      return ctx.reply('Не удалось получить информацию о вашей подписке. Пожалуйста, попробуйте позже.');
    }
    
    // Получаем информацию о плане подписки
    const plan = await getSubscriptionPlan(subscription.plan_id);
    
    if (!plan) {
      return ctx.reply('Не удалось получить информацию о вашем плане подписки. Пожалуйста, попробуйте позже.');
    }
    
    // Форматируем дату окончания подписки
    const endDate = subscription.end_date && !isNaN(new Date(subscription.end_date)) 
      ? new Date(subscription.end_date).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      : 'Бессрочно';
    
    // Форматируем информацию о подписке
    let message = `🔹 *Ваша подписка:* ${plan.name}\n`;
    message += `🔹 *Описание:* ${plan.description}\n`;
    message += `🔹 *Срок действия:* ${endDate}\n`;
    message += `🔹 *Лимит запросов:* ${plan.request_limit === -1 ? 'Безлимитно' : plan.request_limit}\n`;
    
    // Добавляем список доступных моделей
    message += '\n*Доступные модели:*\n';
    if (plan.models_access && Array.isArray(plan.models_access)) {
      plan.models_access.forEach(model => {
        message += `• ${model}\n`;
      });
    } else {
      message += '• Нет доступных моделей\n';
    }
    
    // Добавляем кнопки для управления подпиской
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Изменить подписку', 'change_subscription')],
      plan.price === 0 ? [] : [Markup.button.callback('Отменить подписку', 'cancel_subscription')]
    ].filter(row => row.length > 0));
    
    ctx.replyWithMarkdown(message, keyboard);
    
    logger.info(`User ${ctx.from.id} viewed subscription info`);
  } catch (error) {
    logger.error('Error in subscription command:', error);
    ctx.reply('Произошла ошибка при получении информации о подписке. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик для изменения подписки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleChangeSubscription(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Получаем список доступных планов
    const plans = await getSubscriptionPlans();
    
    if (!plans || plans.length === 0) {
      return ctx.reply('В данный момент нет доступных планов подписки. Пожалуйста, попробуйте позже.');
    }
    
    // Создаем сообщение с описанием планов
    let message = 'Выберите план подписки:\n\n';
    
    // Создаем клавиатуру с планами
    const buttons = plans.map(plan => {
      message += `*${plan.name}*\n`;
      message += `Цена: ${plan.price} руб.\n`;
      message += `Длительность: ${plan.duration_days} дней\n`;
      message += `Описание: ${plan.description}\n\n`;
      
      return [Markup.button.callback(`${plan.name} - ${plan.price} руб.`, `select_plan:${plan.id}`)];
    });
    
    // Добавляем кнопку отмены
    buttons.push([Markup.button.callback('Отмена', 'cancel_subscription')]);
    
    // Отправляем сообщение с выбором плана
    await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
    
    // Сохраняем текущее действие в сессии
    ctx.session.user.currentAction = 'selecting_plan';
    
    logger.info(`User ${ctx.from.id} requested to change subscription`);
  } catch (error) {
    logger.error('Error in change subscription handler:', error);
    ctx.reply('Произошла ошибка при получении списка планов. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик для отмены выбора плана
 * @param {Object} ctx - Контекст Telegram
 */
async function handleCancelPlanSelection(ctx) {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Выбор плана отменен.');
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} canceled plan selection`);
  } catch (error) {
    logger.error('Error in cancel plan selection handler:', error);
    ctx.reply('Произошла ошибка при отмене выбора плана. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик для отмены отмены подписки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleKeepSubscription(ctx) {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Операция отменена. Ваша подписка остается активной.');
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} kept subscription`);
  } catch (error) {
    logger.error('Error in keep subscription handler:', error);
    ctx.reply('Произошла ошибка при отмене операции. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  subscriptionCommand,
  handleChangeSubscription,
  handleCancelPlanSelection,
  handleKeepSubscription
}; 