#!/bin/bash

# Скрипт для развертывания на NAS Synology

# Настройки
SYNOLOGY_HOST="your-synology-host"
SYNOLOGY_USER="your-synology-user"
SYNOLOGY_PATH="/volume2/docker/ra-app-bot"

# Функция для вывода сообщений
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Проверка наличия необходимых утилит
check_dependencies() {
  if ! command -v ssh &> /dev/null; then
    log "Ошибка: ssh не установлен"
    exit 1
  fi
  
  if ! command -v scp &> /dev/null; then
    log "Ошибка: scp не установлен"
    exit 1
  fi
}

# Создание директории на NAS
create_directory() {
  log "Создание директории на NAS..."
  ssh $SYNOLOGY_USER@$SYNOLOGY_HOST "mkdir -p $SYNOLOGY_PATH"
  
  if [ $? -eq 0 ]; then
    log "Директория успешно создана: $SYNOLOGY_PATH"
  else
    log "Ошибка при создании директории"
    exit 1
  fi
}

# Копирование файлов на NAS
copy_files() {
  log "Копирование файлов на NAS..."
  
  # Создание временной директории для файлов
  mkdir -p ./tmp_deploy
  
  # Копирование необходимых файлов во временную директорию
  cp docker-compose.yml ./tmp_deploy/
  cp Dockerfile ./tmp_deploy/
  cp .env.example ./tmp_deploy/
  cp init-db.sql ./tmp_deploy/
  cp deploy.sh ./tmp_deploy/
  cp -r src ./tmp_deploy/
  cp package.json ./tmp_deploy/
  
  # Копирование файлов на NAS
  scp -r ./tmp_deploy/* $SYNOLOGY_USER@$SYNOLOGY_HOST:$SYNOLOGY_PATH/
  
  # Удаление временной директории
  rm -rf ./tmp_deploy
  
  if [ $? -eq 0 ]; then
    log "Файлы успешно скопированы на NAS"
  else
    log "Ошибка при копировании файлов"
    exit 1
  fi
}

# Настройка переменных окружения на NAS
setup_env() {
  log "Настройка переменных окружения на NAS..."
  
  # Проверка наличия .env.example на NAS
  ssh $SYNOLOGY_USER@$SYNOLOGY_HOST "if [ ! -f $SYNOLOGY_PATH/.env ]; then cp $SYNOLOGY_PATH/.env.example $SYNOLOGY_PATH/.env; fi"
  
  log "Файл .env создан на NAS. Пожалуйста, отредактируйте его с помощью редактора на NAS или через SSH."
}

# Запуск сервисов на NAS
start_services() {
  log "Запуск сервисов на NAS..."
  
  # Делаем скрипт deploy.sh исполняемым
  ssh $SYNOLOGY_USER@$SYNOLOGY_HOST "chmod +x $SYNOLOGY_PATH/deploy.sh"
  
  # Запуск сервисов
  ssh $SYNOLOGY_USER@$SYNOLOGY_HOST "cd $SYNOLOGY_PATH && ./deploy.sh start"
  
  if [ $? -eq 0 ]; then
    log "Сервисы успешно запущены на NAS"
  else
    log "Ошибка при запуске сервисов"
    exit 1
  fi
}

# Основная логика
log "Начало процесса развертывания на NAS Synology"

# Проверка зависимостей
check_dependencies

# Запрос данных для подключения к NAS, если они не указаны
if [ "$SYNOLOGY_HOST" = "your-synology-host" ]; then
  read -p "Введите адрес NAS Synology: " SYNOLOGY_HOST
fi

if [ "$SYNOLOGY_USER" = "your-synology-user" ]; then
  read -p "Введите имя пользователя NAS Synology: " SYNOLOGY_USER
fi

# Создание директории на NAS
create_directory

# Копирование файлов на NAS
copy_files

# Настройка переменных окружения на NAS
setup_env

# Запрос на запуск сервисов
read -p "Запустить сервисы на NAS? (y/n): " START_SERVICES
if [ "$START_SERVICES" = "y" ] || [ "$START_SERVICES" = "Y" ]; then
  start_services
else
  log "Запуск сервисов отменен"
  log "Для запуска сервисов вручную выполните следующие команды на NAS:"
  log "cd $SYNOLOGY_PATH && ./deploy.sh start"
fi

log "Процесс развертывания завершен"
exit 0 