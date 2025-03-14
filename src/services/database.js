const { Pool } = require('pg');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

// Создаем пул соединений с базой данных
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20, // максимальное количество клиентов в пуле
  idleTimeoutMillis: 30000, // время ожидания перед закрытием неиспользуемых клиентов
  connectionTimeoutMillis: 2000, // время ожидания при подключении нового клиента
});

// Обработка ошибок пула
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Инициализация таблиц в базе данных
 */
async function initTables() {
  const client = await pool.connect();
  try {
    // Начинаем транзакцию
    await client.query('BEGIN');

    // Создаем таблицу пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL UNIQUE,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        language_code VARCHAR(10),
        is_premium BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Создаем таблицу платежей
    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_payments (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL REFERENCES bot_users(telegram_id),
        payment_id VARCHAR(255) NOT NULL UNIQUE,
        plan_id INTEGER NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'RUB',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        invoice_payload TEXT,
        provider_payment_charge_id VARCHAR(255),
        telegram_payment_charge_id VARCHAR(255),
        receipt_url VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Создаем таблицу подписок
    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_subscriptions (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL REFERENCES bot_users(telegram_id),
        plan_id INTEGER NOT NULL,
        payment_id VARCHAR(255) REFERENCES bot_payments(payment_id),
        start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Создаем таблицу чеков
    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_receipts (
        id SERIAL PRIMARY KEY,
        payment_id VARCHAR(255) NOT NULL REFERENCES bot_payments(payment_id),
        receipt_number VARCHAR(255) NOT NULL,
        receipt_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        receipt_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Завершаем транзакцию
    await client.query('COMMIT');
    logger.info('Database tables initialized successfully');
  } catch (err) {
    // Откатываем транзакцию в случае ошибки
    await client.query('ROLLBACK');
    logger.error('Error initializing database tables:', err);
    throw err;
  } finally {
    // Возвращаем клиент в пул
    client.release();
  }
}

/**
 * Подключение к базе данных и инициализация таблиц
 */
async function dbConnect() {
  try {
    // Проверяем соединение с базой данных
    await pool.query('SELECT NOW()');
    logger.info('Database connection established');
    
    // Инициализируем таблицы
    await initTables();
    
    return true;
  } catch (err) {
    logger.error('Database connection error:', err);
    throw err;
  }
}

/**
 * Выполнение SQL-запроса
 * @param {string} text - SQL-запрос
 * @param {Array} params - Параметры запроса
 * @returns {Promise<Object>} Результат запроса
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error('Error executing query', { text, error: err });
    throw err;
  }
}

module.exports = {
  dbConnect,
  query,
  pool
}; 