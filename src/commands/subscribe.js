const { Markup } = require('telegraf');
const { getSubscriptionPlans } = require('../services/api');
const { createPayment } = require('../services/payment');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Обработчик команды /subscribe
 * @param {Object} ctx - Контекст Telegram
 */
async function subscribeCommand(ctx) {
  try {
    // Проверяем, есть ли у пользователя активная подписка
    if (ctx.state.hasActiveSubscription) {
      return ctx.reply(
        'У вас уже есть активная подписка. Вы можете управлять ею с помощью команды /profile.',
        Markup.inlineKeyboard([
          Markup.button.callback('Перейти в профиль', 'profile')
        ])
      );
    }
    
    // Получаем список планов подписки
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
    
    logger.info(`User ${ctx.from.id} requested subscription plans`);
  } catch (error) {
    logger.error('Error in subscribe command:', error);
    await ctx.reply('Произошла ошибка при получении планов подписки. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик выбора плана подписки
 * @param {Object} ctx - Контекст Telegram
 */
async function handlePlanSelection(ctx) {
  try {
    // Получаем ID плана из callback_data
    const planId = parseInt(ctx.callbackQuery.data.split(':')[1]);
    
    // Создаем платеж
    const { invoice } = await createPayment(ctx, planId);
    
    // Отправляем инвойс для оплаты
    await ctx.replyWithInvoice(invoice);
    
    // Отправляем сообщение с инструкцией
    await ctx.reply(
      'Для завершения подписки, пожалуйста, оплатите счет выше. ' +
      'После успешной оплаты вы получите подтверждение и доступ к сервису.'
    );
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} selected plan ${planId}`);
  } catch (error) {
    logger.error('Error in plan selection:', error);
    await ctx.reply('Произошла ошибка при создании платежа. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик успешного платежа
 * @param {Object} ctx - Контекст Telegram
 */
async function handleSuccessfulPayment(ctx) {
  try {
    // Обрабатываем успешный платеж
    const { planId, endDate, receiptNumber } = await processSuccessfulPayment(ctx);
    
    // Форматируем дату окончания подписки
    const formattedEndDate = new Date(endDate).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Отправляем сообщение об успешной оплате
    await ctx.reply(
      `🎉 Поздравляем! Ваша подписка успешно оформлена.\n\n` +
      `Подписка действительна до: ${formattedEndDate}\n` +
      `Номер чека: ${receiptNumber}\n\n` +
      `Вы можете получить чек с помощью команды /receipt.`
    );
    
    logger.info(`User ${ctx.from.id} successfully paid for plan ${planId}`);
  } catch (error) {
    logger.error('Error in successful payment handler:', error);
    await ctx.reply(
      'Платеж успешно обработан, но произошла ошибка при активации подписки. ' +
      'Пожалуйста, обратитесь в поддержку с помощью команды /support.'
    );
  }
}

/**
 * Обработчик отмены подписки
 * @param {Object} ctx - Контекст Telegram
 */
async function handleCancelSubscription(ctx) {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Оформление подписки отменено.');
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} canceled subscription process`);
  } catch (error) {
    logger.error('Error in cancel subscription handler:', error);
    await ctx.reply('Произошла ошибка при отмене подписки. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  subscribeCommand,
  handlePlanSelection,
  handleSuccessfulPayment,
  handleCancelSubscription
}; 