const { query } = require('../services/database');
const { getUserSubscription } = require('../services/api');
const { setupLogger } = require('../utils/logger');
const { isAdmin } = require('../utils/admin-utils');

const logger = setupLogger();

/**
 * Middleware для аутентификации пользователя
 * Проверяет наличие пользователя в базе данных и создает его при необходимости
 */
async function authMiddleware(ctx, next) {
  try {
    // Пропускаем обновления, которые не от пользователя
    if (!ctx.from) {
      return next();
    }
    
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Инициализируем объект пользователя в сессии, если его нет
    if (!ctx.session.user) {
      ctx.session.user = {};
    }
    
    // Инициализируем объект поддержки в сессии, если его нет
    if (!ctx.session.support) {
      ctx.session.support = {
        currentAction: null,
        replyToUserId: null,
        replyToMessageId: null
      };
    }
    
    const telegramId = ctx.from.id;
    
    // Проверяем, есть ли пользователь в базе данных
    const userResult = await query(
      'SELECT id, username, full_name, telegram_username FROM users WHERE CAST(telegram_id AS TEXT) = $1',
      [telegramId.toString()]
    );
    
    // Если пользователь не найден, создаем его
    if (userResult.rows.length === 0) {
      const fullName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();
      const username = ctx.from.username || `user_${telegramId}`;
      
      // Создаем пользователя в базе данных
      const newUserResult = await query(
        `INSERT INTO users 
         (telegram_id, username, full_name, telegram_username, registration_date) 
         VALUES ($1, $2, $3, $4, NOW()) 
         RETURNING id, username, full_name, telegram_username`,
        [telegramId.toString(), username, fullName, ctx.from.username || null]
      );
      
      // Сохраняем данные пользователя в сессии
      ctx.session.user.dbId = newUserResult.rows[0].id;
      ctx.session.user.username = newUserResult.rows[0].username;
      ctx.session.user.fullName = newUserResult.rows[0].full_name;
      ctx.session.user.telegramUsername = newUserResult.rows[0].telegram_username;
      
      logger.info(`New user created: ${telegramId}`);
    } else {
      // Сохраняем данные пользователя в сессии
      ctx.session.user.dbId = userResult.rows[0].id;
      ctx.session.user.username = userResult.rows[0].username;
      ctx.session.user.fullName = userResult.rows[0].full_name;
      ctx.session.user.telegramUsername = userResult.rows[0].telegram_username;
      
      logger.info(`Updated user: ${telegramId}`);
    }
    
    // Проверяем наличие активной подписки
    const subscription = await getUserSubscription(ctx.session.user.dbId);
    ctx.state.hasActiveSubscription = subscription && subscription.is_active;
    
    return next();
  } catch (error) {
    logger.error('Error in auth middleware:', error);
    return next();
  }
}

/**
 * Middleware для проверки доступа к команде только для администраторов
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function adminMiddleware(ctx, next) {
  try {
    // Получаем ID администраторов из переменной окружения
    let adminIds = [];
    
    if (process.env.ADMIN_IDS) {
      // Разбиваем строку с ID администраторов и преобразуем их в числа
      adminIds = process.env.ADMIN_IDS.split(',')
        .map(id => id.trim())
        .filter(id => id) // Удаляем пустые строки
        .map(id => parseInt(id));
    }
    
    // Если список администраторов пуст, используем ID создателя бота
    if (adminIds.length === 0 && process.env.CREATOR_ID) {
      adminIds.push(parseInt(process.env.CREATOR_ID));
    }
    
    logger.info(`Admin IDs from env: ${process.env.ADMIN_IDS || 'not set'}`);
    logger.info(`Parsed admin IDs: ${adminIds.join(', ') || 'none'}`);
    logger.info(`Current user ID: ${ctx.from.id}, is admin: ${adminIds.includes(ctx.from.id)}`);
    
    // Проверяем, является ли пользователь администратором
    if (adminIds.length > 0 && !adminIds.includes(ctx.from.id)) {
      return ctx.reply('У вас нет доступа к этой команде.');
    }
    
    return next();
  } catch (error) {
    logger.error('Error in admin middleware:', error);
    return ctx.reply('Произошла ошибка при проверке прав доступа. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  authMiddleware,
  adminMiddleware
}; 