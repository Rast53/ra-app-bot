require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const { setupLogger } = require('./utils/logger');
const { dbConnect } = require('./services/database');
const { setupWebhook } = require('./services/webhook');
const { setupMiddlewares } = require('./config/middlewares');
const { setupCommands } = require('./config/commands');
const { setupHandlers } = require('./config/handlers');
const { setupCronJobs } = require('./config/cron');

// Инициализация логгера
const logger = setupLogger();

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Настройка middleware
setupMiddlewares(bot);

// Настройка команд
setupCommands(bot);

// Настройка обработчиков
setupHandlers(bot);

// Подключение к базе данных
dbConnect()
  .then(() => {
    logger.info('Database connected successfully');
    
    // Настройка Express приложения для вебхуков
    const app = express();
    setupWebhook(app, bot);
    
    // Настройка cron-задач
    setupCronJobs(bot);
    
    // Запуск бота
    if (process.env.NODE_ENV === 'production') {
      // Запуск в режиме вебхуков для продакшена
      const PORT = process.env.PORT || 3000;
      const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;
      
      // Настройка вебхука
      bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}/bot${process.env.BOT_TOKEN}`)
        .then(() => {
          logger.info(`Webhook set to ${WEBHOOK_DOMAIN}`);
        })
        .catch((error) => {
          logger.error('Error setting webhook:', error);
        });
      
      // Запуск сервера
      app.listen(PORT, () => {
        logger.info(`Bot server started on port ${PORT}`);
      });
    } else {
      // Запуск в режиме long polling для разработки
      bot.launch()
        .then(() => {
          logger.info('Bot started in polling mode');
        })
        .catch((error) => {
          logger.error('Error starting bot:', error);
        });
    }
    
    // Обработка сигналов завершения
    process.once('SIGINT', () => {
      logger.info('SIGINT signal received');
      bot.stop('SIGINT');
    });
    
    process.once('SIGTERM', () => {
      logger.info('SIGTERM signal received');
      bot.stop('SIGTERM');
    });
  })
  .catch((error) => {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  }); 