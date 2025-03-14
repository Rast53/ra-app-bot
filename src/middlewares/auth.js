const { saveUser } = require('../services/user');
const { isSubscriptionActive } = require('../services/subscription');
const { setupLogger } = require('../utils/logger');
const { isAdmin } = require('../commands/admin');

const logger = setupLogger();

/**
 * Middleware для аутентификации пользователя
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function userMiddleware(ctx, next) {
  try {
    // Если сообщение от анонимного пользователя в группе или от системы, пропускаем
    if (!ctx.from || ctx.from.is_bot || ctx.from.id === 777000 || ctx.from.id === 1087968824) {
      return next();
    }
    
    // Если сообщение из группового чата и не от администратора, пропускаем
    if (ctx.chat && ctx.chat.type !== 'private' && !isAdmin(ctx.from.id)) {
      return next();
    }
    
    // Сохраняем пользователя в базе данных
    const user = await saveUser(ctx.from);
    
    // Добавляем пользователя в контекст
    ctx.state.user = user;
    
    return next();
  } catch (error) {
    logger.error('Error in user middleware:', error);
    return next();
  }
}

/**
 * Middleware для проверки подписки пользователя
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function subscriptionMiddleware(ctx, next) {
  try {
    if (ctx.from) {
      // Проверяем активность подписки
      const isActive = await isSubscriptionActive(ctx.from.id);
      ctx.state.hasActiveSubscription = isActive;
    }
    
    return next();
  } catch (error) {
    logger.error('Error in subscription middleware:', error);
    ctx.state.hasActiveSubscription = false;
    return next();
  }
}

/**
 * Middleware для проверки доступа к команде только для пользователей с активной подпиской
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function requireSubscription(ctx, next) {
  try {
    // Если у пользователя нет активной подписки, отправляем сообщение
    if (!ctx.state.hasActiveSubscription) {
      return ctx.reply(
        'Для использования этой команды необходима активная подписка. ' +
        'Пожалуйста, оформите подписку с помощью команды /subscribe.'
      );
    }
    
    return next();
  } catch (error) {
    logger.error('Error in require subscription middleware:', error);
    return ctx.reply('Произошла ошибка при проверке подписки. Пожалуйста, попробуйте позже.');
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
  userMiddleware,
  subscriptionMiddleware,
  requireSubscription,
  adminMiddleware
}; 