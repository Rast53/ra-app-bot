const { Pool } = require('pg');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

// Получаем параметры подключения из переменных окружения
let poolConfig = {};

// Проверяем наличие строки подключения DATABASE_URL
if (process.env.DATABASE_URL) {
  logger.info('Using DATABASE_URL for connection');
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
  };
} else {
  // Используем отдельные параметры подключения
  const dbHost = process.env.POSTGRES_HOST || '127.0.0.1';
  const dbPort = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const dbName = process.env.POSTGRES_DB || 'postgres';
  const dbUser = process.env.POSTGRES_USER || 'postgres';
  const dbPassword = process.env.POSTGRES_PASSWORD || '';
  const dbSsl = process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false;

  // Логируем параметры подключения (без пароля)
  logger.info(`Database connection parameters: host=${dbHost}, port=${dbPort}, database=${dbName}, user=${dbUser}, ssl=${!!dbSsl}`);

  poolConfig = {
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: dbSsl
  };
}

// Создаем пул соединений с базой данных
const pool = new Pool(poolConfig);

/**
 * Подключение к базе данных
 * @returns {Promise<void>}
 */
async function connectToDatabase() {
  try {
    // Проверяем соединение с базой данных
    const client = await pool.connect();
    
    // Получаем информацию о текущей базе данных и пользователе
    const dbInfoResult = await client.query('SELECT current_database(), current_user');
    const currentDb = dbInfoResult.rows[0].current_database;
    const currentUser = dbInfoResult.rows[0].current_user;
    
    logger.info(`Database connection established to ${currentDb} as ${currentUser}`);
    
    // Проверяем наличие необходимых таблиц
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'user_subscriptions', 'payments')
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    logger.info(`Found tables: ${tables.join(', ')}`);
    
    // Проверяем наличие колонки telegram_id в таблице users
    const columnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'telegram_id'
    `);
    
    if (columnsResult.rows.length > 0) {
      logger.info('Column telegram_id exists in users table');
    } else {
      logger.warn('Column telegram_id does not exist in users table');
    }
    
    client.release();
    return true;
  } catch (error) {
    logger.error('Error connecting to database:', error);
    throw error;
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
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn(`Slow query (${duration}ms): ${text}`);
    }
    
    return result;
  } catch (error) {
    logger.error('Error executing query', { error, text });
    throw error;
  }
}

module.exports = {
  query,
  connectToDatabase,
  pool
}; 