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
    
    // Преобразуем id в строку, так как в базе данных он хранится как строка
    const stringId = String(id);
    
    // Проверяем, существует ли пользователь
    const existingUser = await query(
      'SELECT * FROM users WHERE CAST(telegram_id AS TEXT) = $1',
      [stringId]
    );
    
    if (existingUser.rows.length > 0) {
      // Обновляем существующего пользователя
      const result = await query(
        `UPDATE users 
         SET telegram_username = $1, 
             full_name = $2,
             telegram_photo_url = $3,
             last_login = NOW() 
         WHERE CAST(telegram_id AS TEXT) = $4 
         RETURNING *`,
        [
          username || existingUser.rows[0].telegram_username,
          `${first_name || ''} ${last_name || ''}`.trim() || existingUser.rows[0].full_name,
          user.photo_url || existingUser.rows[0].telegram_photo_url,
          stringId
        ]
      );
      
      logger.info(`Updated user: ${id}`);
      return result.rows[0];
    } else {
      // Создаем нового пользователя
      const result = await query(
        `INSERT INTO users 
         (telegram_id, telegram_username, full_name, telegram_photo_url, registration_date, last_login) 
         VALUES ($1, $2, $3, $4, NOW(), NOW()) 
         RETURNING *`,
        [
          stringId, 
          username, 
          `${first_name || ''} ${last_name || ''}`.trim(), 
          user.photo_url || null
        ]
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
 * @param {number|string} telegramId - Telegram ID пользователя
 * @returns {Promise<Object>} Пользователь
 */
async function getUser(telegramId) {
  try {
    // Преобразуем telegramId в строку, так как в базе данных он хранится как строка
    const stringTelegramId = String(telegramId);
    
    const result = await query(
      'SELECT * FROM users WHERE CAST(telegram_id AS TEXT) = $1',
      [stringTelegramId]
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
 * Получение всех пользователей с Telegram ID
 * @returns {Promise<Array>} Список пользователей
 */
async function getAllUsers() {
  try {
    const result = await query(
      'SELECT * FROM users WHERE telegram_id IS NOT NULL ORDER BY registration_date DESC'
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
    const totalUsers = await query('SELECT COUNT(*) FROM users WHERE telegram_id IS NOT NULL');
    const activeSubscriptions = await query(
      'SELECT COUNT(*) FROM user_subscriptions us JOIN users u ON us.user_id = u.id WHERE u.telegram_id IS NOT NULL AND us.is_active = true AND us.end_date > NOW()'
    );
    const newUsersToday = await query(
      "SELECT COUNT(*) FROM users WHERE telegram_id IS NOT NULL AND registration_date > NOW() - INTERVAL '1 day'"
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