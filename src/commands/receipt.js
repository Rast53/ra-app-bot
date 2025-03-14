const { getUserSubscription } = require('../services/subscription');
const { getReceipt, generateReceiptNumber } = require('../services/payment');
const { setupLogger } = require('../utils/logger');
const { query } = require('../services/database');
const { getSubscriptionPlan } = require('../services/api');

const logger = setupLogger();

/**
 * Обработчик команды /receipt
 * @param {Object} ctx - Контекст Telegram
 */
async function receiptCommand(ctx) {
  try {
    const telegramId = ctx.from.id;
    
    // Проверяем, есть ли у пользователя активная подписка
    const subscription = await getUserSubscription(telegramId);
    
    if (!subscription) {
      return ctx.reply('У вас нет активной подписки. Оформите подписку с помощью команды /subscribe.');
    }
    
    try {
      // Пытаемся получить информацию о чеке
      const receipt = await getReceipt(subscription.payment_id);
      
      // Формируем сообщение с информацией о чеке
      const receiptData = receipt.receipt_data;
      const message = `
*Чек об оплате*

*Номер чека:* ${receiptData.number}
*Дата:* ${new Date(receiptData.date).toLocaleDateString('ru-RU')}
*Сумма:* ${receiptData.amount} ${receiptData.currency}
*Описание:* ${receiptData.description}

*Продавец:*
*Имя:* ${receiptData.seller.name}
*ИНН:* ${receiptData.seller.inn}
*Телефон:* ${receiptData.seller.phone}
*Email:* ${receiptData.seller.email}
`;
      
      // Отправляем сообщение с информацией о чеке
      await ctx.replyWithMarkdown(message);
      
      logger.info(`User ${ctx.from.id} requested receipt`);
    } catch (error) {
      // Если чек не найден, создаем новый чек для существующей подписки
      if (error.message === 'Чек не найден') {
        logger.info(`Receipt not found for payment ${subscription.payment_id}, creating new receipt`);
        
        try {
          const receipt = await createReceiptForExistingSubscription(telegramId, subscription);
          
          // Формируем сообщение с информацией о чеке
          const receiptData = receipt.receipt_data;
          const message = `
*Чек об оплате*

*Номер чека:* ${receiptData.number}
*Дата:* ${new Date(receiptData.date).toLocaleDateString('ru-RU')}
*Сумма:* ${receiptData.amount} ${receiptData.currency}
*Описание:* ${receiptData.description}

*Продавец:*
*Имя:* ${receiptData.seller.name}
*ИНН:* ${receiptData.seller.inn}
*Телефон:* ${receiptData.seller.phone}
*Email:* ${receiptData.seller.email}
`;
          
          // Отправляем сообщение с информацией о чеке
          await ctx.replyWithMarkdown(message);
          
          logger.info(`User ${ctx.from.id} received newly created receipt`);
        } catch (createError) {
          logger.error('Error creating receipt for existing subscription:', createError);
          await ctx.reply('Произошла ошибка при создании чека. Пожалуйста, обратитесь в поддержку.');
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Error in receipt command:', error);
    await ctx.reply('Произошла ошибка при получении чека. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Создание чека для существующей подписки
 * @param {number|string} telegramId - Telegram ID пользователя
 * @param {Object} subscription - Информация о подписке
 * @returns {Promise<Object>} Созданный чек
 */
async function createReceiptForExistingSubscription(telegramId, subscription) {
  try {
    // Преобразуем telegramId в строку
    const stringTelegramId = String(telegramId);
    
    // Получаем ID пользователя из таблицы users
    const userResult = await query(
      'SELECT id FROM users WHERE CAST(telegram_id AS TEXT) = $1',
      [stringTelegramId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('Пользователь не найден');
    }
    
    const userId = userResult.rows[0].id;
    
    // Получаем информацию о плане подписки
    const plan = await getSubscriptionPlan(subscription.plan_id);
    
    if (!plan) {
      throw new Error('План подписки не найден');
    }
    
    // Получаем ID платежа из базы данных
    const paymentResult = await query(
      `SELECT id FROM payments WHERE payment_id = $1`,
      [subscription.payment_id]
    );
    
    if (paymentResult.rows.length === 0) {
      throw new Error('Платеж не найден');
    }
    
    const paymentDbId = paymentResult.rows[0].id;
    
    // Генерируем чек
    const receiptNumber = generateReceiptNumber();
    const receiptData = {
      number: receiptNumber,
      date: new Date(),
      amount: Number(plan.price) || 0,
      currency: 'RUB',
      description: `Подписка "${plan.name}" на ${plan.duration_days} дней`,
      seller: {
        name: process.env.SELF_EMPLOYED_NAME || 'ИП',
        inn: process.env.SELF_EMPLOYED_INN || '000000000000',
        phone: process.env.SELF_EMPLOYED_PHONE || '+7 (000) 000-00-00',
        email: process.env.SELF_EMPLOYED_EMAIL || 'info@example.com'
      },
      buyer: {
        telegram_id: stringTelegramId,
        user_id: userId
      }
    };
    
    // Сохраняем чек в базе данных
    await query(
      `INSERT INTO receipts 
       (payment_id, receipt_number, receipt_data) 
       VALUES ($1, $2, $3)
       RETURNING *`,
      [paymentDbId, receiptNumber, JSON.stringify(receiptData)]
    );
    
    return {
      receipt_number: receiptNumber,
      receipt_data: receiptData
    };
  } catch (error) {
    logger.error(`Error creating receipt for existing subscription:`, error);
    throw error;
  }
}

/**
 * Обработчик получения чека через кнопку
 * @param {Object} ctx - Контекст Telegram
 */
async function handleGetReceipt(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Вызываем команду получения чека
    await receiptCommand(ctx);
    
    logger.info(`User ${ctx.from.id} requested receipt via button`);
  } catch (error) {
    logger.error('Error in get receipt handler:', error);
    await ctx.reply('Произошла ошибка при получении чека. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  receiptCommand,
  handleGetReceipt,
  createReceiptForExistingSubscription
}; 