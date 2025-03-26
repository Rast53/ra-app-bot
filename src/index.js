require('dotenv').config();
const { setupLogger } = require('./utils/logger');
const { initBot } = require('./bot');
const { Telegraf } = require('telegraf');
const { connectToDatabase } = require('./services/database');

const logger = setupLogger();

// Создаем экземпляр бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Добавьте вначале файла
console.log('Запуск бота с настройками:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || 3000);
console.log('BOT_TOKEN доступен:', !!process.env.BOT_TOKEN);
console.log('WEBHOOK_DOMAIN:', process.env.WEBHOOK_DOMAIN);

// Основная функция запуска приложения
async function startApp() {
  try {
    // Подключаемся к базе данных
    await connectToDatabase();
    
    // Инициализируем бота
    await initBot(bot);
    
    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Error starting application:', error);
    process.exit(1);
  }
}

// Запускаем приложение
startApp(); 