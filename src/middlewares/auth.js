const { saveUser } = require('../services/user');
const { isSubscriptionActive } = require('../services/subscription');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Middleware для сохранения информации о пользователе
 * @param {Object} ctx - Контекст Telegram
 * @param {Function} next - Функция для перехода к следующему middleware
 */
async function userMiddleware(ctx, next) {
  try {
    if (ctx.from) {
      // Сохраняем информацию о пользователе
      const user = await saveUser(ctx.from);
      ctx.state.user = user;
    }
    
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
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];
    
    // Проверяем, является ли пользователь администратором
    if (!adminIds.includes(ctx.from.id)) {
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