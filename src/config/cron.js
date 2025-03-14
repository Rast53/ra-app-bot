const cron = require('node-cron');
const { checkExpiredSubscriptions, getExpiringSubscriptions } = require('../services/subscription');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Настройка cron-задач для бота
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupCronJobs(bot) {
  // Задача для проверки истекших подписок (каждый день в полночь)
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Running cron job: check expired subscriptions');
      
      const expiredSubscriptions = await checkExpiredSubscriptions();
      
      logger.info(`Deactivated ${expiredSubscriptions.length} expired subscriptions`);
    } catch (error) {
      logger.error('Error in check expired subscriptions cron job:', error);
    }
  });
  
  // Задача для уведомления о подписках, истекающих через 3 дня (каждый день в 10:00)
  cron.schedule('0 10 * * *', async () => {
    try {
      logger.info('Running cron job: notify about expiring subscriptions');
      
      const expiringSubscriptions = await getExpiringSubscriptions(3);
      
      // Отправляем уведомления пользователям
      for (const subscription of expiringSubscriptions) {
        try {
          const endDate = new Date(subscription.end_date).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          
          await bot.telegram.sendMessage(
            subscription.telegram_id,
            `⚠️ *Внимание!* Ваша подписка истекает ${endDate}.\n\n` +
            `Чтобы продолжить пользоваться сервисом, пожалуйста, продлите подписку с помощью команды /subscribe.`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          logger.error(`Error sending expiration notification to user ${subscription.telegram_id}:`, error);
        }
      }
      
      logger.info(`Sent ${expiringSubscriptions.length} expiration notifications`);
    } catch (error) {
      logger.error('Error in notify about expiring subscriptions cron job:', error);
    }
  });
  
  logger.info('Cron jobs set up successfully');
  
  return bot;
}

module.exports = {
  setupCronJobs
};