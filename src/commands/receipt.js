const { getUserSubscription } = require('../services/subscription');
const { getReceipt } = require('../services/payment');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Обработчик команды /receipt
 * @param {Object} ctx - Контекст Telegram
 */
async function receiptCommand(ctx) {
  try {
    const telegramId = ctx.from.id;
    
    // Проверяем, есть ли у пользователя активная подписка
    const subscription = await getUserSubscription(telegramId);
    
    if (!subscription) {
      return ctx.reply('У вас нет активной подписки. Оформите подписку с помощью команды /subscribe.');
    }
    
    // Получаем информацию о чеке
    const receipt = await getReceipt(subscription.payment_id);
    
    if (!receipt) {
      return ctx.reply('Не удалось найти чек для вашей подписки. Пожалуйста, обратитесь в поддержку.');
    }
    
    // Формируем сообщение с информацией о чеке
    const receiptData = receipt.receipt_data;
    const message = `
*Чек об оплате*

*Номер чека:* ${receiptData.number}
*Дата:* ${new Date(receiptData.date).toLocaleDateString('ru-RU')}
*Сумма:* ${receiptData.amount} ${receiptData.currency}
*Описание:* ${receiptData.description}

*Продавец:*
*Имя:* ${receiptData.seller.name}
*ИНН:* ${receiptData.seller.inn}
*Телефон:* ${receiptData.seller.phone}
*Email:* ${receiptData.seller.email}
`;
    
    // Отправляем сообщение с информацией о чеке
    await ctx.replyWithMarkdown(message);
    
    logger.info(`User ${ctx.from.id} requested receipt`);
  } catch (error) {
    logger.error('Error in receipt command:', error);
    await ctx.reply('Произошла ошибка при получении чека. Пожалуйста, попробуйте позже.');
  }
}

/**
 * Обработчик получения чека через кнопку
 * @param {Object} ctx - Контекст Telegram
 */
async function handleGetReceipt(ctx) {
  try {
    await ctx.answerCbQuery();
    
    // Вызываем команду получения чека
    await receiptCommand(ctx);
    
    logger.info(`User ${ctx.from.id} requested receipt via button`);
  } catch (error) {
    logger.error('Error in get receipt handler:', error);
    await ctx.reply('Произошла ошибка при получении чека. Пожалуйста, попробуйте позже.');
  }
}

module.exports = {
  receiptCommand,
  handleGetReceipt
}; 