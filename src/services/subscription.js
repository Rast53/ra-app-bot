const { query } = require('./database');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Получение информации о подписке пользователя
 * @param {number} telegramId - Telegram ID пользователя
 * @returns {Promise<Object>} Информация о подписке
 */
async function getUserSubscription(telegramId) {
  try {
    const result = await query(
      `SELECT s.*, p.payment_id, p.status as payment_status
       FROM bot_subscriptions s
       LEFT JOIN bot_payments p ON s.payment_id = p.payment_id
       WHERE s.telegram_id = $1 AND s.is_active = true`,
      [telegramId]
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
 * @param {number} telegramId - Telegram ID пользователя
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
 * @param {number} telegramId - Telegram ID пользователя
 * @returns {Promise<Array>} Список подписок
 */
async function getUserSubscriptions(telegramId) {
  try {
    const result = await query(
      `SELECT s.*, p.payment_id, p.status as payment_status
       FROM bot_subscriptions s
       LEFT JOIN bot_payments p ON s.payment_id = p.payment_id
       WHERE s.telegram_id = $1
       ORDER BY s.created_at DESC`,
      [telegramId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error(`Error getting subscriptions for user ${telegramId}:`, error);
    throw error;
  }
}

/**
 * Отмена подписки пользователя
 * @param {number} telegramId - Telegram ID пользователя
 * @returns {Promise<boolean>} Результат отмены подписки
 */
async function cancelSubscription(telegramId) {
  try {
    const result = await query(
      `UPDATE bot_subscriptions
       SET is_active = false, updated_at = NOW()
       WHERE telegram_id = $1 AND is_active = true`,
      [telegramId]
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
      `SELECT s.*, u.telegram_id
       FROM bot_subscriptions s
       JOIN bot_users u ON s.telegram_id = u.telegram_id
       WHERE s.is_active = true AND s.end_date < NOW()`
    );
    
    // Деактивируем истекшие подписки
    if (result.rows.length > 0) {
      const ids = result.rows.map(row => row.id);
      
      await query(
        `UPDATE bot_subscriptions
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
      `SELECT s.*, u.telegram_id
       FROM bot_subscriptions s
       JOIN bot_users u ON s.telegram_id = u.telegram_id
       WHERE s.is_active = true 
       AND s.end_date > NOW() 
       AND s.end_date < NOW() + INTERVAL '${days} days'`
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