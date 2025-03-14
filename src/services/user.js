const { query } = require('./database');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Получение пользователя по Telegram ID
 * @param {number|string} telegramId - Telegram ID пользователя
 * @returns {Promise<Object>} Пользователь или null, если пользователь не найден
 */
async function getUserByTelegramId(telegramId) {
  try {
    const result = await query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Error getting user by Telegram ID ${telegramId}:`, error);
    return null;
  }
}

/**
 * Создание или обновление пользователя
 * @param {Object} user - Объект пользователя Telegram
 * @returns {Promise<Object>} Созданный или обновленный пользователь
 */
async function saveUser(user) {
  try {
    // Проверяем, существует ли пользователь
    const existingUser = await getUserByTelegramId(user.id);
    
    // Если пользователь существует, обновляем его данные
    if (existingUser) {
      const result = await query(
        `UPDATE users 
         SET telegram_username = $1, 
             full_name = $2, 
             telegram_photo_url = $3, 
             last_login = NOW() 
         WHERE telegram_id = $4 
         RETURNING *`,
        [
          user.username || `user_${user.id}`, // Устанавливаем значение по умолчанию для username
          `${user.first_name || ''} ${user.last_name || ''}`.trim() || `User ${user.id}`,
          user.photo?.small_file_id || null,
          user.id
        ]
      );
      
      logger.info(`Updated user: ${user.id}`);
      return result.rows[0];
    }
    
    // Если пользователь не существует, создаем нового
    const result = await query(
      `INSERT INTO users 
         (telegram_id, telegram_username, full_name, telegram_photo_url, registration_date, last_login) 
         VALUES ($1, $2, $3, $4, NOW(), NOW()) 
         RETURNING *`,
      [
        user.id,
        user.username || `user_${user.id}`, // Устанавливаем значение по умолчанию для username
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || `User ${user.id}`,
        user.photo?.small_file_id || null
      ]
    );
    
    logger.info(`Created new user: ${user.id}`);
    return result.rows[0];
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
  getUserStats,
  getUserByTelegramId
};