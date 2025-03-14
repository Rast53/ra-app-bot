#!/bin/bash

# Скрипт для сборки и публикации Docker-образа

# Загрузка переменных окружения
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Проверка наличия переменных
if [ -z "$DOCKER_REGISTRY" ] || [ -z "$DOCKER_IMAGE_TAG" ]; then
  echo "Ошибка: Переменные DOCKER_REGISTRY и DOCKER_IMAGE_TAG должны быть определены в файле .env"
  exit 1
fi

# Функция для вывода сообщений
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Сборка образа
build_image() {
  log "Сборка Docker-образа..."
  docker build -t $DOCKER_REGISTRY/ra-app-bot:$DOCKER_IMAGE_TAG .
  
  if [ $? -eq 0 ]; then
    log "Образ успешно собран: $DOCKER_REGISTRY/ra-app-bot:$DOCKER_IMAGE_TAG"
  else
    log "Ошибка при сборке образа"
    exit 1
  fi
}

# Публикация образа
push_image() {
  log "Публикация Docker-образа..."
  docker push $DOCKER_REGISTRY/ra-app-bot:$DOCKER_IMAGE_TAG
  
  if [ $? -eq 0 ]; then
    log "Образ успешно опубликован: $DOCKER_REGISTRY/ra-app-bot:$DOCKER_IMAGE_TAG"
  else
    log "Ошибка при публикации образа"
    exit 1
  fi
}

# Основная логика
log "Начало процесса сборки и публикации Docker-образа"

# Проверка авторизации в Docker Registry
if ! docker info > /dev/null 2>&1; then
  log "Ошибка: Docker не запущен или у вас нет прав для его использования"
  exit 1
fi

# Сборка образа
build_image

# Запрос на публикацию
read -p "Опубликовать образ в Docker Registry? (y/n): " PUBLISH
if [ "$PUBLISH" = "y" ] || [ "$PUBLISH" = "Y" ]; then
  push_image
else
  log "Публикация образа отменена"
fi

log "Процесс завершен"
exit 0 