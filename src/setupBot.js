function setupBot() {
  // Проверяем наличие токена
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error('BOT_TOKEN не указан в переменных окружения');
  }
  
  // Создаем экземпляр бота
  const bot = new Telegraf(token);
  
  // Настраиваем сессию
  bot.use(session());
  
  // Настраиваем middleware
  setupMiddleware(bot);
  
  // Настраиваем команды
  setupCommands(bot);
  
  // Настраиваем обработчики
  setupHandlers(bot);
  
  // Настраиваем cron-задачи
  setupCronJobs(bot);

  // Здесь мы можем увидеть, использует ли бот webhook или polling
  // Обычно это выглядит так:
  if (process.env.NODE_ENV === 'production') {
    // Webhook режим
    bot.telegram.setWebhook(`${process.env.WEBHOOK_DOMAIN}/telegram/bot${process.env.BOT_TOKEN}`);
  } else {
    // Long polling режим
    bot.telegram.deleteWebhook();
    bot.launch();
  }
} 