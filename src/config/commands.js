const { startCommand } = require('../commands/start');
const { helpCommand } = require('../commands/help');
const { subscribeCommand } = require('../commands/subscribe');
const { profileCommand } = require('../commands/profile');
const { receiptCommand } = require('../commands/receipt');
const { supportCommand } = require('../commands/support');
const { adminCommand, adminSupportCommand } = require('../commands/admin');
const { adminMiddleware } = require('../middlewares/auth');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Настройка команд бота
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupCommands(bot) {
  // Регистрируем команды
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('subscribe', subscribeCommand);
  bot.command('profile', profileCommand);
  bot.command('receipt', receiptCommand);
  bot.command('support', supportCommand);
  
  // Команды для администраторов
  bot.command('admin', adminMiddleware, adminCommand);
  bot.command('admin_support', adminMiddleware, adminSupportCommand);
  
  // Устанавливаем команды в меню бота
  bot.telegram.setMyCommands([
    { command: 'start', description: 'Запустить бота' },
    { command: 'help', description: 'Показать справку' },
    { command: 'subscribe', description: 'Оформить подписку' },
    { command: 'profile', description: 'Информация о профиле' },
    { command: 'receipt', description: 'Получить чек' },
    { command: 'support', description: 'Связаться с поддержкой' }
  ]).then(() => {
    logger.info('Bot commands set successfully');
  }).catch(error => {
    logger.error('Error setting bot commands:', error);
  });
  
  return bot;
}

module.exports = {
  setupCommands
}; 