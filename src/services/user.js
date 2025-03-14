const { query } = require('./database');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Создание или обновление пользователя
 * @param {Object} user - Объект пользователя Telegram
 * @returns {Promise<Object>} Созданный или обновленный пользователь
 */
async function saveUser(user) {
  try {
    const { id, username, first_name, last_name, language_code, is_premium } = user;
    
    // Проверяем, существует ли пользователь
    const existingUser = await query(
      'SELECT * FROM bot_users WHERE telegram_id = $1',
      [id]
    );
    
    if (existingUser.rows.length > 0) {
      // Обновляем существующего пользователя
      const result = await query(
        `UPDATE bot_users 
         SET username = $1, 
             first_name = $2, 
             last_name = $3, 
             language_code = $4, 
             is_premium = $5, 
             updated_at = NOW() 
         WHERE telegram_id = $6 
         RETURNING *`,
        [
          username || existingUser.rows[0].username,
          first_name || existingUser.rows[0].first_name,
          last_name || existingUser.rows[0].last_name,
          language_code || existingUser.rows[0].language_code,
          is_premium !== undefined ? is_premium : existingUser.rows[0].is_premium,
          id
        ]
      );
      
      logger.info(`Updated user: ${id}`);
      return result.rows[0];
    } else {
      // Создаем нового пользователя
      const result = await query(
        `INSERT INTO bot_users 
         (telegram_id, username, first_name, last_name, language_code, is_premium) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [id, username, first_name, last_name, language_code, is_premium || false]
      );
      
      logger.info(`Created new user: ${id}`);
      return result.rows[0];
    }
  } catch (error) {
    logger.error('Error saving user:', error);
    throw error;
  }
}

/**
 * Получение пользователя по Telegram ID
 * @param {number} telegramId - Telegram ID пользователя
 * @returns {Promise<Object>} Пользователь
 */
async function getUser(telegramId) {
  try {
    const result = await query(
      'SELECT * FROM bot_users WHERE telegram_id = $1',
      [telegramId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Error getting user ${telegramId}:`, error);
    throw error;
  }
}

/**
 * Получение всех пользователей
 * @returns {Promise<Array>} Список пользователей
 */
async function getAllUsers() {
  try {
    const result = await query(
      'SELECT * FROM bot_users ORDER BY created_at DESC'
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error getting all users:', error);
    throw error;
  }
}

/**
 * Получение статистики пользователей
 * @returns {Promise<Object>} Статистика пользователей
 */
async function getUserStats() {
  try {
    const totalUsers = await query('SELECT COUNT(*) FROM bot_users');
    const activeSubscriptions = await query(
      'SELECT COUNT(*) FROM bot_subscriptions WHERE is_active = true AND end_date > NOW()'
    );
    const newUsersToday = await query(
      "SELECT COUNT(*) FROM bot_users WHERE created_at > NOW() - INTERVAL '1 day'"
    );
    
    return {
      totalUsers: parseInt(totalUsers.rows[0].count),
      activeSubscriptions: parseInt(activeSubscriptions.rows[0].count),
      newUsersToday: parseInt(newUsersToday.rows[0].count)
    };
  } catch (error) {
    logger.error('Error getting user stats:', error);
    throw error;
  }
}

module.exports = {
  saveUser,
  getUser,
  getAllUsers,
  getUserStats
};