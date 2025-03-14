const { setupLogger } = require('../utils/logger');
const { processSuccessfulPayment } = require('../services/payment');

const logger = setupLogger();

/**
 * Обработчик предварительной проверки платежа
 * @param {Object} ctx - Контекст Telegram
 */
async function handlePreCheckoutQuery(ctx) {
  try {
    // Отвечаем на предварительную проверку платежа
    await ctx.answerPreCheckoutQuery(true);
    
    logger.info(`Pre-checkout query from user ${ctx.from.id} approved`);
  } catch (error) {
    logger.error('Error in pre-checkout query handler:', error);
    await ctx.answerPreCheckoutQuery(false, 'Произошла ошибка при обработке платежа. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик успешного платежа
 * @param {Object} ctx - Контекст Telegram
 */
async function handleSuccessfulPayment(ctx) {
  try {
    // Обрабатываем успешный платеж
    const { planId, endDate, receiptNumber } = await processSuccessfulPayment(ctx);
    
    // Форматируем дату окончания подписки
    const formattedEndDate = new Date(endDate).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Отправляем сообщение об успешной оплате
    await ctx.reply(
      `🎉 Поздравляем! Ваша подписка успешно оформлена.\n\n` +
      `Подписка действительна до: ${formattedEndDate}\n` +
      `Номер чека: ${receiptNumber}\n\n` +
      `Вы можете получить чек с помощью команды /receipt.`
    );
    
    logger.info(`User ${ctx.from.id} successfully paid for plan ${planId}`);
  } catch (error) {
    logger.error('Error in successful payment handler:', error);
    await ctx.reply(
      'Платеж успешно обработан, но произошла ошибка при активации подписки. ' +
      'Пожалуйста, обратитесь в поддержку с помощью команды /support.'
    );
  }
}

module.exports = {
  handlePreCheckoutQuery,
  handleSuccessfulPayment
}; 