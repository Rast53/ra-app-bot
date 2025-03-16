const { Markup } = require('telegraf');
const { getSubscriptionPlans, getSubscriptionPlan, getUserSubscription, activateSubscription } = require('../services/api');
const { createPayment, processSuccessfulPayment, generateReceiptNumber, createTelegramInvoice } = require('../services/payment');
const { setupLogger } = require('../utils/logger');
const { query } = require('../services/database');
const crypto = require('crypto');

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
 * Обрабатывает выбор плана подписки
 * @param {Object} ctx - Контекст Telegram
 */
async function handlePlanSelection(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Получаем ID выбранного плана из callback_data
    const planId = parseInt(ctx.callbackQuery.data.split(':')[1]);
    
    // Получаем информацию о плане
    const plan = await getSubscriptionPlan(planId);
    logger.info('Plan info:', plan);
    
    if (!plan) {
      return ctx.reply('План подписки не найден. Пожалуйста, выберите другой план.');
    }
    
    // Проверяем, что у пользователя есть dbId в сессии
    if (!ctx.session.user || !ctx.session.user.dbId) {
      // Получаем ID пользователя из базы данных
      const userResult = await query(
        'SELECT id FROM users WHERE CAST(telegram_id AS TEXT) = $1',
        [ctx.from.id.toString()]
      );
      
      if (userResult.rows.length === 0) {
        return ctx.reply('Ваш профиль не найден. Пожалуйста, перезапустите бота командой /start.');
      }
      
      // Сохраняем ID пользователя в сессии
      if (!ctx.session.user) ctx.session.user = {};
      ctx.session.user.dbId = userResult.rows[0].id;
    }
    
    // Проверяем, бесплатный ли план
    logger.info('Plan price:', plan.price, 'type:', typeof plan.price);
    const isFree = parseFloat(plan.price) === 0;
    
    if (isFree) {
      try {
        logger.info(`Activating free plan ${planId} for user ${ctx.session.user.dbId}`);
        
        // Проверяем, есть ли у пользователя неактивная подписка
        const subscriptionResult = await query(
          'SELECT * FROM user_subscriptions WHERE user_id = $1',
          [ctx.session.user.dbId]
        );
        
        // Генерируем уникальный ID платежа
        const paymentId = Date.now().toString();
        
        // Создаем запись о "платеже" со статусом "completed"
        // Используем только те колонки, которые точно есть в таблице
        const paymentResult = await query(
          `INSERT INTO payments 
           (user_id, plan_id, amount, status, payment_id, currency) 
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            ctx.session.user.dbId, 
            planId, 
            0, 
            'completed', 
            paymentId,
            'RUB'
          ]
        );
        
        const dbPaymentId = paymentResult.rows[0].id;
        
        // Если у пользователя уже есть подписка, обновляем её
        if (subscriptionResult.rows.length > 0) {
          // Рассчитываем дату окончания подписки
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + plan.duration_days);
          
          await query(
            `UPDATE user_subscriptions 
             SET plan_id = $1, 
                 payment_id = $2, 
                 end_date = $3, 
                 is_active = true
             WHERE user_id = $4`,
            [planId, dbPaymentId, endDate, ctx.session.user.dbId]
          );
          
          logger.info(`Updated subscription for user ${ctx.from.id} to plan ${planId}`);
        } else {
          // Активируем подписку через API функцию
          await activateSubscription(ctx.session.user.dbId, planId, dbPaymentId);
          logger.info(`Created new subscription for user ${ctx.from.id} with plan ${planId}`);
        }
        
        // Отправляем сообщение об успешной активации
        await ctx.reply(
          `✅ Бесплатный план "${plan.name}" успешно активирован!\n\n` +
          `Срок действия: ${plan.duration_days} дней\n` +
          `Лимит запросов: ${plan.request_limit}\n\n` +
          `Доступные модели: ${plan.models_access.join(', ')}`
        );
        
        logger.info(`Free plan ${planId} activated for user ${ctx.from.id}`);
        return;
      } catch (error) {
        logger.error(`Error activating free plan for user ${ctx.from.id}:`, error);
        return ctx.reply('Произошла ошибка при активации бесплатного плана. Пожалуйста, попробуйте позже или обратитесь в поддержку.');
      }
    }
    
    // Для платных планов создаем платеж через Telegram
    try {
      // Создаем инвойс для оплаты
      const invoice = await createTelegramInvoice(ctx.session.user.dbId, planId);
      
      if (!invoice || !invoice.invoice_link) {
        return ctx.reply('Не удалось создать ссылку для оплаты. Пожалуйста, попробуйте позже.');
      }
      
      // Отправляем сообщение со ссылкой на оплату
      await ctx.reply(
        `Для оформления подписки "${plan.name}" перейдите по ссылке ниже:\n\n` +
        `${invoice.invoice_link}\n\n` +
        'После успешной оплаты ваша подписка будет активирована автоматически.',
        { disable_web_page_preview: true }
      );
      
      logger.info(`Payment invoice created for user ${ctx.from.id}, plan ${planId}`);
    } catch (error) {
      logger.error(`Error creating payment for user ${ctx.from.id}:`, error);
      await ctx.reply('Произошла ошибка при создании платежа. Пожалуйста, попробуйте позже или обратитесь в поддержку.');
    }
  } catch (error) {
    logger.error('Error in plan selection handler:', error);
    await ctx.reply('Произошла ошибка при выборе плана подписки. Пожалуйста, попробуйте позже.');
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