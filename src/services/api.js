const axios = require('axios');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

// Создаем экземпляр axios с базовыми настройками
const apiClient = axios.create({
  baseURL: process.env.API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.API_TOKEN}`
  }
});

// Обработка ошибок запросов
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // Ошибка от сервера с ответом
      logger.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config.url,
        method: error.config.method
      });
    } else if (error.request) {
      // Запрос был сделан, но ответ не получен
      logger.error('API No Response:', {
        request: error.request,
        url: error.config.url,
        method: error.config.method
      });
    } else {
      // Ошибка при настройке запроса
      logger.error('API Request Error:', {
        message: error.message,
        url: error.config?.url,
        method: error.config?.method
      });
    }
    return Promise.reject(error);
  }
);

/**
 * Получение списка планов подписки
 * @returns {Promise<Array>} Список планов подписки
 */
async function getSubscriptionPlans() {
  try {
    const response = await apiClient.get('/subscription/plans');
    return response.data;
  } catch (error) {
    logger.error('Error fetching subscription plans:', error);
    throw error;
  }
}

/**
 * Получение информации о плане подписки
 * @param {number} planId - ID плана подписки
 * @returns {Promise<Object>} Информация о плане подписки
 */
async function getSubscriptionPlan(planId) {
  try {
    const response = await apiClient.get(`/subscription/plans/${planId}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching subscription plan ${planId}:`, error);
    throw error;
  }
}

/**
 * Получение информации о подписке пользователя
 * @param {number} userId - ID пользователя
 * @returns {Promise<Object>} Информация о подписке пользователя
 */
async function getUserSubscription(userId) {
  try {
    const response = await apiClient.get(`/subscription/user/${userId}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching user subscription for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Активация подписки пользователя
 * @param {number} userId - ID пользователя
 * @param {number} planId - ID плана подписки
 * @param {string} paymentId - ID платежа
 * @returns {Promise<Object>} Результат активации подписки
 */
async function activateSubscription(userId, planId, paymentId) {
  try {
    const response = await apiClient.post('/subscription/activate', {
      userId,
      planId,
      paymentId
    });
    return response.data;
  } catch (error) {
    logger.error(`Error activating subscription for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Отмена подписки пользователя
 * @param {number} userId - ID пользователя
 * @returns {Promise<Object>} Результат отмены подписки
 */
async function cancelSubscription(userId) {
  try {
    const response = await apiClient.post('/subscription/cancel', {
      userId
    });
    return response.data;
  } catch (error) {
    logger.error(`Error canceling subscription for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Проверка статуса платежа
 * @param {string} paymentId - ID платежа
 * @returns {Promise<Object>} Статус платежа
 */
async function checkPaymentStatus(paymentId) {
  try {
    const response = await apiClient.get(`/payment/status/${paymentId}`);
    return response.data;
  } catch (error) {
    logger.error(`Error checking payment status for payment ${paymentId}:`, error);
    throw error;
  }
}

module.exports = {
  getSubscriptionPlans,
  getSubscriptionPlan,
  getUserSubscription,
  activateSubscription,
  cancelSubscription,
  checkPaymentStatus
}; 