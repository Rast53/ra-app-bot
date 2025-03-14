const express = require('express');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

/**
 * Настройка Express приложения для обработки вебхуков
 * @param {express.Application} app - Express приложение
 * @param {Object} bot - Экземпляр Telegraf бота
 */
function setupWebhook(app, bot) {
  // Парсинг JSON
  app.use(express.json());
  
  // Маршрут для проверки работоспособности
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // Маршрут для вебхука Telegram
  app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
    bot.handleUpdate(req.body, res);
  });
  
  // Обработка ошибок
  app.use((err, req, res, next) => {
    logger.error('Express error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });
  
  return app;
}

module.exports = {
  setupWebhook
}; 