const { setupLogger } = require('./logger');

const logger = setupLogger();

// Список ID администраторов
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);

/**
 * Проверка, является ли пользователь администратором
 * @param {number} userId - ID пользователя в Telegram
 * @returns {boolean} Результат проверки
 */
function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

module.exports = {
  isAdmin
}; 