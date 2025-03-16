require('dotenv').config();
const { setupLogger } = require('./utils/logger');
const { initBot } = require('./bot');
const { Telegraf } = require('telegraf');
const { connectToDatabase } = require('./services/database');

const logger = setupLogger();

// Создаем экземпляр бота
const bot = new Telegraf(process.env.BOT_TOKEN);

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