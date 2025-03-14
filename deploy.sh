#!/bin/bash

# Скрипт для развертывания и управления сервисами на NAS Synology

# Функция для вывода сообщений
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Проверка наличия docker и docker-compose
check_dependencies() {
  if ! command -v docker &> /dev/null; then
    log "Ошибка: Docker не установлен"
    exit 1
  fi
  
  if ! command -v docker-compose &> /dev/null; then
    log "Ошибка: Docker Compose не установлен"
    exit 1
  fi
}

# Запуск сервисов
start_services() {
  log "Запуск сервисов..."
  docker-compose up -d
  log "Сервисы запущены"
}

# Остановка сервисов
stop_services() {
  log "Остановка сервисов..."
  docker-compose down
  log "Сервисы остановлены"
}

# Перезапуск сервисов
restart_services() {
  log "Перезапуск сервисов..."
  docker-compose restart
  log "Сервисы перезапущены"
}

# Обновление сервисов
update_services() {
  log "Обновление сервисов..."
  docker-compose pull
  docker-compose up -d
  log "Сервисы обновлены"
}

# Просмотр логов
view_logs() {
  log "Просмотр логов..."
  docker-compose logs -f
}

# Проверка статуса сервисов
check_status() {
  log "Статус сервисов:"
  docker-compose ps
}

# Основная логика
check_dependencies

case "$1" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    restart_services
    ;;
  update)
    update_services
    ;;
  logs)
    view_logs
    ;;
  status)
    check_status
    ;;
  *)
    echo "Использование: $0 {start|stop|restart|update|logs|status}"
    exit 1
    ;;
esac

exit 0 