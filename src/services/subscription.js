const { query } = require('./database');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Получение информации о подписке пользователя
 * @param {number|string} telegramId - Telegram ID пользователя
 * @returns {Promise<Object>} Информация о подписке
 */
async function getUserSubscription(telegramId) {
  try {
    // Преобразуем telegramId в число
    const numericTelegramId = Number(telegramId);
    
    const result = await query(
      `SELECT us.*, p.payment_id, p.status as payment_status
       FROM user_subscriptions us
       JOIN users u ON us.user_id = u.id
       LEFT JOIN payments p ON us.payment_id = p.id
       WHERE u.telegram_id = $1 AND us.is_active = true
       AND us.end_date > NOW()
       ORDER BY us.end_date DESC
       LIMIT 1`,
      [numericTelegramId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Error getting subscription for user ${telegramId}:`, error);
    throw error;
  }
}

/**
 * Проверка активности подписки пользователя
 * @param {number|string} telegramId - Telegram ID пользователя
 * @returns {Promise<boolean>} Активна ли подписка
 */
async function isSubscriptionActive(telegramId) {
  try {
    const subscription = await getUserSubscription(telegramId);
    
    if (!subscription) {
      return false;
    }
    
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    
    return subscription.is_active && endDate > now;
  } catch (error) {
    logger.error(`Error checking subscription status for user ${telegramId}:`, error);
    throw error;
  }
}

/**
 * Получение информации о всех подписках пользователя
 * @param {number|string} telegramId - Telegram ID пользователя
 * @returns {Promise<Array>} Список подписок
 */
async function getUserSubscriptions(telegramId) {
  try {
    // Преобразуем telegramId в число
    const numericTelegramId = Number(telegramId);
    
    const result = await query(
      `SELECT us.*, p.payment_id, p.status as payment_status
       FROM user_subscriptions us
       JOIN users u ON us.user_id = u.id
       LEFT JOIN payments p ON us.payment_id = p.id
       WHERE u.telegram_id = $1
       ORDER BY us.created_at DESC`,
      [numericTelegramId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error(`Error getting subscriptions for user ${telegramId}:`, error);
    throw error;
  }
}

/**
 * Отмена подписки пользователя
 * @param {number|string} telegramId - Telegram ID пользователя
 * @returns {Promise<boolean>} Результат отмены подписки
 */
async function cancelSubscription(telegramId) {
  try {
    // Преобразуем telegramId в число
    const numericTelegramId = Number(telegramId);
    
    const result = await query(
      `UPDATE user_subscriptions us
       SET is_active = false
       FROM users u
       WHERE us.user_id = u.id
       AND u.telegram_id = $1 
       AND us.is_active = true`,
      [numericTelegramId]
    );
    
    return result.rowCount > 0;
  } catch (error) {
    logger.error(`Error canceling subscription for user ${telegramId}:`, error);
    throw error;
  }
}

/**
 * Проверка истекших подписок и отправка уведомлений
 * @returns {Promise<Array>} Список истекших подписок
 */
async function checkExpiredSubscriptions() {
  try {
    const result = await query(
      `SELECT us.*, u.telegram_id
       FROM user_subscriptions us
       JOIN users u ON us.user_id = u.id
       WHERE us.is_active = true 
       AND us.end_date < NOW()
       AND u.telegram_id IS NOT NULL`
    );
    
    // Деактивируем истекшие подписки
    if (result.rows.length > 0) {
      const ids = result.rows.map(row => row.id);
      
      await query(
        `UPDATE user_subscriptions
         SET is_active = false, updated_at = NOW()
         WHERE id = ANY($1)`,
        [ids]
      );
      
      logger.info(`Deactivated ${result.rows.length} expired subscriptions`);
    }
    
    return result.rows;
  } catch (error) {
    logger.error('Error checking expired subscriptions:', error);
    throw error;
  }
}

/**
 * Получение списка подписок, истекающих в ближайшее время
 * @param {number} days - Количество дней до истечения
 * @returns {Promise<Array>} Список подписок
 */
async function getExpiringSubscriptions(days = 3) {
  try {
    const result = await query(
      `SELECT us.*, u.telegram_id
       FROM user_subscriptions us
       JOIN users u ON us.user_id = u.id
       WHERE us.is_active = true 
       AND us.end_date > NOW() 
       AND us.end_date < NOW() + INTERVAL '${days} days'
       AND u.telegram_id IS NOT NULL`
    );
    
    return result.rows;
  } catch (error) {
    logger.error(`Error getting subscriptions expiring in ${days} days:`, error);
    throw error;
  }
}

module.exports = {
  getUserSubscription,
  isSubscriptionActive,
  getUserSubscriptions,
  cancelSubscription,
  checkExpiredSubscriptions,
  getExpiringSubscriptions
}; 