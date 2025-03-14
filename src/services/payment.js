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
    
    // Получаем данные о плане подписки
    const plan = await getSubscriptionPlan(planId);
    
    if (!plan) {
      throw new Error('План подписки не найден');
    }
    
    // Генерируем уникальный ID платежа
    const paymentId = `tg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Создаем payload для платежа
    const payload = JSON.stringify({
      planId: plan.id,
      userId: telegramId,
      paymentId
    });
    
    // Создаем объект счета
    const invoice = {
      chat_id: telegramId,
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
    await query(
      `INSERT INTO bot_payments 
       (telegram_id, payment_id, plan_id, amount, status, invoice_payload) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [telegramId, paymentId, plan.id, plan.price, 'pending', payload]
    );
    
    return {
      invoice,
      paymentId
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
    const { planId, userId, paymentId } = payload;
    
    // Обновляем статус платежа в базе данных
    await query(
      `UPDATE bot_payments 
       SET status = $1, 
           telegram_payment_charge_id = $2, 
           provider_payment_charge_id = $3, 
           updated_at = NOW() 
       WHERE payment_id = $4`,
      ['completed', telegram_payment_charge_id, provider_payment_charge_id, paymentId]
    );
    
    // Получаем данные о плане подписки
    const plan = await getSubscriptionPlan(planId);
    
    // Вычисляем дату окончания подписки
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);
    
    // Проверяем, есть ли уже активная подписка
    const subscriptionResult = await query(
      `SELECT * FROM bot_subscriptions 
       WHERE telegram_id = $1 AND is_active = true`,
      [userId]
    );
    
    if (subscriptionResult.rows.length > 0) {
      // Если есть активная подписка, продлеваем ее
      await query(
        `UPDATE bot_subscriptions 
         SET plan_id = $1, 
             payment_id = $2, 
             end_date = $3, 
             updated_at = NOW() 
         WHERE telegram_id = $4 AND is_active = true`,
        [planId, paymentId, endDate, userId]
      );
    } else {
      // Если нет активной подписки, создаем новую
      await query(
        `INSERT INTO bot_subscriptions 
         (telegram_id, plan_id, payment_id, end_date) 
         VALUES ($1, $2, $3, $4)`,
        [userId, planId, paymentId, endDate]
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
        telegram_id: userId
      }
    };
    
    // Сохраняем чек в базе данных
    await query(
      `INSERT INTO bot_receipts 
       (payment_id, receipt_number, receipt_data) 
       VALUES ($1, $2, $3)`,
      [paymentId, receiptNumber, receiptData]
    );
    
    return {
      paymentId,
      planId,
      userId,
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
 * @param {string} paymentId - ID платежа
 * @returns {Promise<Object>} Информация о платеже
 */
async function getPaymentInfo(paymentId) {
  try {
    const result = await query(
      `SELECT * FROM bot_payments WHERE payment_id = $1`,
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
 * @param {string} paymentId - ID платежа
 * @returns {Promise<Object>} Информация о чеке
 */
async function getReceipt(paymentId) {
  try {
    const result = await query(
      `SELECT * FROM bot_receipts WHERE payment_id = $1`,
      [paymentId]
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

module.exports = {
  createPayment,
  processSuccessfulPayment,
  getPaymentInfo,
  getReceipt
}; 