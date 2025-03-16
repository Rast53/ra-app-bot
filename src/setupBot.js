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
} 