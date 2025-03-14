const axios = require('axios');
const { query } = require('./database');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

// Создаем экземпляр axios с базовыми настройками
const apiClient = axios.create({
  baseURL: process.env.API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.API_TOKEN || ''}`
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
 * Получение списка планов подписки из базы данных
 * @returns {Promise<Array>} Список планов подписки
 */
async function getSubscriptionPlans() {
  try {
    const result = await query(
      `SELECT * FROM subscription_plans ORDER BY price ASC`
    );
    return result.rows;
  } catch (error) {
    logger.error('Error fetching subscription plans from database:', error);
    
    // Если не удалось получить из БД, пробуем получить из API
    try {
      const response = await apiClient.get('/api/subscription/plans');
      return response.data;
    } catch (apiError) {
      logger.error('Error fetching subscription plans from API:', apiError);
      throw apiError;
    }
  }
}

/**
 * Получение информации о плане подписки из базы данных
 * @param {number} planId - ID плана подписки
 * @returns {Promise<Object>} Информация о плане подписки
 */
async function getSubscriptionPlan(planId) {
  try {
    const result = await query(
      `SELECT * FROM subscription_plans WHERE id = $1`,
      [planId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Subscription plan with ID ${planId} not found`);
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching subscription plan ${planId} from database:`, error);
    
    // Если не удалось получить из БД, пробуем получить из API
    try {
      const response = await apiClient.get(`/api/subscription/plans/${planId}`);
      return response.data;
    } catch (apiError) {
      logger.error(`Error fetching subscription plan ${planId} from API:`, apiError);
      throw apiError;
    }
  }
}

/**
 * Получение информации о подписке пользователя из базы данных
 * @param {number} userId - ID пользователя
 * @returns {Promise<Object>} Информация о подписке пользователя
 */
async function getUserSubscription(userId) {
  try {
    const result = await query(
      `SELECT us.*, sp.name as plan_name, sp.description as plan_description, sp.price as plan_price, sp.duration_days
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = $1 AND us.is_active = true AND us.end_date > NOW()
       ORDER BY us.end_date DESC
       LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching user subscription for user ${userId} from database:`, error);
    
    // Если не удалось получить из БД, пробуем получить из API
    try {
      const response = await apiClient.get(`/api/subscription/user/${userId}`);
      return response.data;
    } catch (apiError) {
      logger.error(`Error fetching user subscription for user ${userId} from API:`, apiError);
      throw apiError;
    }
  }
}

/**
 * Активирует подписку для пользователя
 * @param {number} userId - ID пользователя в базе данных
 * @param {number} planId - ID плана подписки
 * @param {number} paymentId - ID платежа
 * @returns {Promise<Object>} - Информация о подписке
 */
async function activateSubscription(userId, planId, paymentId) {
  try {
    logger.info(`Activating subscription for user ${userId}, plan ${planId}, payment ${paymentId}`);
    
    // Проверяем, существует ли уже подписка для этого пользователя
    const existingSubscription = await query(
      'SELECT * FROM user_subscriptions WHERE user_id = $1',
      [userId]
    );
    
    // Получаем информацию о плане подписки
    const plan = await getSubscriptionPlan(planId);
    if (!plan) {
      throw new Error(`Subscription plan with ID ${planId} not found`);
    }
    
    // Рассчитываем дату окончания подписки
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);
    
    let subscription;
    
    if (existingSubscription.rows.length > 0) {
      // Если подписка уже существует, обновляем её
      subscription = await query(
        `UPDATE user_subscriptions 
         SET plan_id = $1, 
             payment_id = $2, 
             end_date = $3, 
             is_active = true
         WHERE user_id = $4
         RETURNING *`,
        [planId, paymentId, endDate, userId]
      );
      
      logger.info(`Updated existing subscription for user ${userId}`);
    } else {
      // Если подписки нет, создаем новую
      subscription = await query(
        `INSERT INTO user_subscriptions 
         (user_id, plan_id, payment_id, end_date, is_active) 
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [userId, planId, paymentId, endDate]
      );
      
      logger.info(`Created new subscription for user ${userId}`);
    }
    
    // Пытаемся также активировать подписку через API (если доступно)
    try {
      const apiResponse = await axios.post('/api/subscription/activate', {
        userId,
        planId,
        paymentId
      });
      
      logger.info(`API subscription activation response:`, apiResponse.data);
    } catch (apiError) {
      // Если API недоступен, продолжаем работу с локальной базой данных
      logger.error('API No Response:', {
        url: '/api/subscription/activate',
        method: 'post',
        request: apiError.request
      });
    }
    
    return subscription.rows[0];
  } catch (error) {
    logger.error(`Error activating subscription for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Отмена подписки пользователя в базе данных
 * @param {number} userId - ID пользователя
 * @returns {Promise<Object>} Результат отмены подписки
 */
async function cancelSubscription(userId) {
  try {
    const result = await query(
      `UPDATE user_subscriptions
       SET is_active = false, updated_at = NOW()
       WHERE user_id = $1 AND is_active = true
       RETURNING *`,
      [userId]
    );
    
    return {
      success: result.rowCount > 0,
      subscription: result.rows[0] || null
    };
  } catch (error) {
    logger.error(`Error canceling subscription for user ${userId}:`, error);
    
    // Если не удалось отменить в БД, пробуем через API
    try {
      const response = await apiClient.post('/api/subscription/cancel', {
        userId
      });
      return response.data;
    } catch (apiError) {
      logger.error(`Error canceling subscription for user ${userId} via API:`, apiError);
      throw apiError;
    }
  }
}

/**
 * Проверка статуса платежа в базе данных
 * @param {number} paymentId - ID платежа (теперь BIGINT)
 * @returns {Promise<Object>} Статус платежа
 */
async function checkPaymentStatus(paymentId) {
  try {
    const result = await query(
      `SELECT * FROM payments WHERE payment_id = $1`,
      [paymentId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }
    
    return {
      success: true,
      payment: result.rows[0]
    };
  } catch (error) {
    logger.error(`Error checking payment status for payment ${paymentId}:`, error);
    
    // Если не удалось получить из БД, пробуем через API
    try {
      const response = await apiClient.get(`/api/payment/status/${paymentId}`);
      return response.data;
    } catch (apiError) {
      logger.error(`Error checking payment status for payment ${paymentId} via API:`, apiError);
      throw apiError;
    }
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