const { Pool } = require('pg');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

// Создаем пул соединений с базой данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
 * Проверка наличия необходимых полей в таблицах
 */
async function checkTables() {
  const client = await pool.connect();
  try {
    // Проверяем наличие поля telegram_id в таблице users
    const userResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'telegram_id'
    `);
    
    if (userResult.rows.length === 0) {
      logger.warn('Column telegram_id not found in users table');
    } else {
      logger.info('Column telegram_id exists in users table');
    }
    
    // Проверяем наличие необходимых таблиц
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND 
      table_name IN ('users', 'user_subscriptions', 'payments')
    `);
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    logger.info(`Found tables: ${existingTables.join(', ')}`);
    
    if (existingTables.length < 3) {
      logger.warn('Some required tables are missing');
    }
    
    return true;
  } catch (err) {
    logger.error('Error checking database tables:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Подключение к базе данных и проверка таблиц
 */
async function dbConnect() {
  try {
    // Проверяем соединение с базой данных
    const result = await pool.query('SELECT current_database(), current_user');
    logger.info(`Database connection established to ${result.rows[0].current_database} as ${result.rows[0].current_user}`);
    
    // Проверяем таблицы
    await checkTables();
    
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