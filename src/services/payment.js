const crypto = require('crypto');
const { query } = require('./database');
const { setupLogger } = require('../utils/logger');
const { getSubscriptionPlan } = require('./api');

const logger = setupLogger();

/**
 * Создание платежа в Telegram
 * @param {Object} ctx - Контекст Telegram
 * @param {number} planId - ID плана подписки
 * @returns {Promise<Object>} Информация о созданном платеже
 */
async function createPayment(ctx, planId) {
  try {
    const telegramId = ctx.from.id;
    
    // Преобразуем telegramId в строку, так как в базе данных он хранится как строка
    const stringTelegramId = String(telegramId);
    
    // Получаем данные о плане подписки
    const plan = await getSubscriptionPlan(planId);
    
    if (!plan) {
      throw new Error('План подписки не найден');
    }
    
    // Получаем ID пользователя из таблицы users
    const userResult = await query(
      'SELECT id FROM users WHERE CAST(telegram_id AS TEXT) = $1',
      [stringTelegramId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('Пользователь не найден');
    }
    
    const userId = userResult.rows[0].id;
    
    // Генерируем уникальный ID платежа (числовой формат для BIGINT)
    const paymentId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    
    // Создаем payload для платежа
    const payload = JSON.stringify({
      planId: plan.id,
      userId: userId,
      telegramId: stringTelegramId,
      paymentId
    });
    
    // Создаем объект счета
    const invoice = {
      chat_id: telegramId, // Здесь оставляем числовой ID для Telegram API
      title: `Подписка "${plan.name}"`,
      description: plan.description,
      payload,
      provider_token: process.env.TELEGRAM_PROVIDER_TOKEN,
      currency: 'RUB',
      prices: [
        {
          label: `${plan.name} (${plan.duration_days} дней)`,
          amount: Math.round(plan.price * 100) // в копейках
        }
      ],
      start_parameter: `plan_${plan.id}`
    };
    
    // Сохраняем информацию о платеже в базе данных
    const paymentResult = await query(
      `INSERT INTO payments 
       (user_id, payment_id, plan_id, amount, status) 
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, paymentId, plan.id, plan.price, 'pending']
    );
    
    return {
      invoice,
      paymentId,
      paymentDbId: paymentResult.rows[0].id
    };
  } catch (error) {
    logger.error('Error creating payment:', error);
    throw error;
  }
}

/**
 * Обработка успешного платежа
 * @param {Object} ctx - Контекст Telegram
 * @returns {Promise<Object>} Результат обработки платежа
 */
async function processSuccessfulPayment(ctx) {
  try {
    const { successful_payment } = ctx.message;
    const { telegram_payment_charge_id, provider_payment_charge_id, total_amount, invoice_payload } = successful_payment;
    const payload = JSON.parse(invoice_payload);
    const { planId, userId, telegramId, paymentId } = payload;
    
    // Преобразуем telegramId в строку, если он еще не строка
    const stringTelegramId = String(telegramId);
    
    // Обновляем статус платежа в базе данных (paymentId теперь числовой)
    const paymentResult = await query(
      `UPDATE payments 
       SET status = $1, 
           telegram_payment_charge_id = $2,
           provider_payment_charge_id = $3,
           updated_at = NOW() 
       WHERE payment_id = $4
       RETURNING id`,
      ['completed', telegram_payment_charge_id, provider_payment_charge_id, paymentId]
    );
    
    if (paymentResult.rows.length === 0) {
      throw new Error('Платеж не найден');
    }
    
    const paymentDbId = paymentResult.rows[0].id;
    
    // Получаем данные о плане подписки
    const plan = await getSubscriptionPlan(planId);
    
    // Вычисляем дату окончания подписки
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);
    
    // Проверяем, есть ли уже активная подписка
    const subscriptionResult = await query(
      `SELECT * FROM user_subscriptions 
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    
    if (subscriptionResult.rows.length > 0) {
      // Если есть активная подписка, продлеваем ее
      await query(
        `UPDATE user_subscriptions 
         SET plan_id = $1, 
             payment_id = $2, 
             end_date = $3, 
             updated_at = NOW() 
         WHERE user_id = $4 AND is_active = true`,
        [planId, paymentDbId, endDate, userId]
      );
    } else {
      // Если нет активной подписки, создаем новую
      await query(
        `INSERT INTO user_subscriptions 
         (user_id, plan_id, payment_id, end_date, is_active) 
         VALUES ($1, $2, $3, $4, true)`,
        [userId, planId, paymentDbId, endDate]
      );
    }
    
    // Генерируем чек
    const receiptNumber = generateReceiptNumber();
    const receiptData = {
      number: receiptNumber,
      date: new Date(),
      amount: total_amount / 100, // переводим копейки в рубли
      currency: 'RUB',
      description: `Подписка "${plan.name}" на ${plan.duration_days} дней`,
      seller: {
        name: process.env.SELF_EMPLOYED_NAME,
        inn: process.env.SELF_EMPLOYED_INN,
        phone: process.env.SELF_EMPLOYED_PHONE,
        email: process.env.SELF_EMPLOYED_EMAIL
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
       VALUES ($1, $2, $3)`,
      [paymentDbId, receiptNumber, JSON.stringify(receiptData)]
    );
    
    return {
      paymentId,
      planId,
      userId,
      telegramId,
      endDate,
      receiptNumber
    };
  } catch (error) {
    logger.error('Error processing successful payment:', error);
    throw error;
  }
}

/**
 * Генерация номера чека
 * @returns {string} Номер чека
 */
function generateReceiptNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = crypto.randomBytes(4).toString('hex');
  
  return `RA-${year}${month}${day}-${random}`;
}

/**
 * Получение информации о платеже
 * @param {number} paymentId - ID платежа (теперь BIGINT)
 * @returns {Promise<Object>} Информация о платеже
 */
async function getPaymentInfo(paymentId) {
  try {
    const result = await query(
      `SELECT * FROM payments WHERE payment_id = $1`,
      [paymentId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Платеж не найден');
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Error getting payment info for payment ${paymentId}:`, error);
    throw error;
  }
}

/**
 * Получение чека по ID платежа
 * @param {number} paymentId - ID платежа (теперь BIGINT)
 * @returns {Promise<Object>} Информация о чеке
 */
async function getReceipt(paymentId) {
  try {
    // Сначала получаем ID платежа из базы данных
    const paymentResult = await query(
      `SELECT id FROM payments WHERE payment_id = $1`,
      [paymentId]
    );
    
    if (paymentResult.rows.length === 0) {
      throw new Error('Платеж не найден');
    }
    
    const paymentDbId = paymentResult.rows[0].id;
    
    // Затем получаем чек по ID платежа
    const result = await query(
      `SELECT * FROM receipts WHERE payment_id = $1`,
      [paymentDbId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Чек не найден');
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Error getting receipt for payment ${paymentId}:`, error);
    throw error;
  }
}

/**
 * Создание инвойса для оплаты через Telegram
 * @param {number} userId - ID пользователя в базе данных
 * @param {number} planId - ID плана подписки
 * @returns {Promise<Object>} Информация о созданном инвойсе
 */
async function createTelegramInvoice(userId, planId) {
  try {
    logger.info(`Creating Telegram invoice for user ${userId}, plan ${planId}`);
    
    // Получаем данные о плане подписки
    const plan = await getSubscriptionPlan(planId);
    
    if (!plan) {
      throw new Error('План подписки не найден');
    }
    
    // Получаем данные о пользователе
    const userResult = await query(
      'SELECT telegram_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error(`Пользователь с ID ${userId} не найден`);
    }
    
    const telegramId = userResult.rows[0].telegram_id;
    if (!telegramId) {
      throw new Error(`У пользователя с ID ${userId} не указан Telegram ID`);
    }
    
    // Генерируем уникальный ID платежа
    const paymentId = Date.now();
    
    // Создаем payload для платежа
    const payload = JSON.stringify({
      planId: plan.id,
      userId: userId,
      telegramId: telegramId,
      paymentId
    });
    
    // Проверяем, что цена плана корректно преобразуется в число
    const planPrice = parseFloat(plan.price);
    if (isNaN(planPrice)) {
      throw new Error(`Некорректная цена плана: ${plan.price}`);
    }
    
    // Создаем объект инвойса
    const invoice = {
      title: `Подписка "${plan.name}"`,
      description: plan.description,
      payload,
      provider_token: process.env.TELEGRAM_PROVIDER_TOKEN,
      currency: 'RUB',
      prices: [
        {
          label: `${plan.name} (${plan.duration_days} дней)`,
          amount: Math.round(planPrice * 100) // в копейках
        }
      ],
      start_parameter: `plan_${plan.id}`
    };
    
    // Сохраняем информацию о платеже в базе данных
    const paymentResult = await query(
      `INSERT INTO payments 
       (user_id, payment_id, plan_id, amount, status, currency) 
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, paymentId, plan.id, planPrice, 'pending', 'RUB']
    );
    
    // Генерируем ссылку для оплаты
    const botUsername = process.env.BOT_USERNAME;
    if (!botUsername) {
      throw new Error('BOT_USERNAME не указан в переменных окружения');
    }
    
    // Создаем ссылку для оплаты
    const invoiceLink = `https://t.me/${botUsername}?start=invoice_${paymentId}`;
    
    logger.info(`Created Telegram invoice with link: ${invoiceLink}`);
    
    return {
      invoice_link: invoiceLink,
      payment_id: paymentId,
      db_payment_id: paymentResult.rows[0].id
    };
  } catch (error) {
    logger.error('Error creating Telegram invoice:', error);
    throw error;
  }
}

module.exports = {
  createPayment,
  processSuccessfulPayment,
  getPaymentInfo,
  getReceipt,
  generateReceiptNumber,
  createTelegramInvoice
}; 