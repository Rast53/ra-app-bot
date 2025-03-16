const { startCommand } = require('../commands/start');
const { helpCommand } = require('../commands/help');
const { subscribeCommand } = require('../commands/subscribe');
const { profileCommand } = require('../commands/profile');
const { receiptCommand } = require('../commands/receipt');
const { supportCommand } = require('../commands/support');
const { adminCommand, adminSupportCommand } = require('../commands/admin');
const { adminMiddleware } = require('../middlewares/auth');
const { setupLogger } = require('../utils/logger');
const { subscriptionCommand } = require('../commands/subscription');

const logger = setupLogger();

/**
 * Настройка команд бота
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupCommands(bot) {
  try {
    // Регистрируем команды
    if (typeof startCommand === 'function') {
      bot.command('start', startCommand);
    } else {
      logger.warn('Function startCommand is not defined, skipping start command setup');
    }
    
    if (typeof helpCommand === 'function') {
      bot.command('help', helpCommand);
    } else {
      logger.warn('Function helpCommand is not defined, skipping help command setup');
    }
    
    if (typeof subscribeCommand === 'function') {
      bot.command('subscribe', subscribeCommand);
    } else {
      logger.warn('Function subscribeCommand is not defined, skipping subscribe command setup');
    }
    
    if (typeof subscriptionCommand === 'function') {
      bot.command('subscription', subscriptionCommand);
    } else {
      logger.warn('Function subscriptionCommand is not defined, skipping subscription command setup');
    }
    
    if (typeof profileCommand === 'function') {
      bot.command('profile', profileCommand);
    } else {
      logger.warn('Function profileCommand is not defined, skipping profile command setup');
    }
    
    if (typeof receiptCommand === 'function') {
      bot.command('receipt', receiptCommand);
    } else {
      logger.warn('Function receiptCommand is not defined, skipping receipt command setup');
    }
    
    if (typeof supportCommand === 'function') {
      bot.command('support', supportCommand);
    } else {
      logger.warn('Function supportCommand is not defined, skipping support command setup');
    }
    
    // Команды для администраторов
    if (typeof adminMiddleware === 'function' && typeof adminCommand === 'function') {
      bot.command('admin', adminMiddleware, adminCommand);
    } else {
      logger.warn('Function adminMiddleware or adminCommand is not defined, skipping admin command setup');
    }
    
    if (typeof adminMiddleware === 'function' && typeof adminSupportCommand === 'function') {
      bot.command('admin_support', adminMiddleware, adminSupportCommand);
    } else {
      logger.warn('Function adminMiddleware or adminSupportCommand is not defined, skipping admin_support command setup');
    }
    
    // Устанавливаем команды в меню бота
    bot.telegram.setMyCommands([
      { command: 'start', description: 'Запустить бота' },
      { command: 'help', description: 'Показать справку' },
      { command: 'subscribe', description: 'Оформить подписку' },
      { command: 'subscription', description: 'Информация о подписке' },
      { command: 'profile', description: 'Информация о профиле' },
      { command: 'receipt', description: 'Получить чек' },
      { command: 'support', description: 'Связаться с поддержкой' }
    ]).then(() => {
      logger.info('Bot commands set successfully');
    }).catch(error => {
      logger.error('Error setting bot commands:', error);
    });
  } catch (error) {
    logger.error('Error setting up commands:', error);
  }
  
  return bot;
}

module.exports = {
  setupCommands
}; 