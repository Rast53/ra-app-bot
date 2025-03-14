const { setupLogger } = require('../utils/logger');
const { startCommand } = require('../commands/start');
const { helpCommand } = require('../commands/help');
const { subscribeCommand } = require('../commands/subscribe');
const { profileCommand } = require('../commands/profile');
const { supportCommand } = require('../commands/support');
const { adminCommand } = require('../commands/admin');
const { receiptCommand } = require('../commands/receipt');

const logger = setupLogger();

/**
 * Настройка обработчиков команд
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupCommandHandlers(bot) {
  // Регистрация обработчиков команд
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('subscribe', subscribeCommand);
  bot.command('profile', profileCommand);
  bot.command('support', supportCommand);
  bot.command('admin', adminCommand);
  bot.command('receipt', receiptCommand);
  
  logger.info('Command handlers set up successfully');
  
  return bot;
}

module.exports = {
  setupCommandHandlers
}; 