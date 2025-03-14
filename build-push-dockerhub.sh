#!/bin/bash

# Скрипт для сборки и отправки образа в Docker Hub

echo "Начало выполнения скрипта..."

# Загрузка переменных окружения из .env файла, если он существует
if [ -f .env ]; then
  echo "Загрузка переменных из .env файла..."
  export $(grep -v '^#' .env | xargs)
  echo "Переменные загружены."
else
  echo "Файл .env не найден."
fi

# Версия образа
VERSION=${DOCKER_IMAGE_TAG:-latest}
DOCKER_HUB_USERNAME=${DOCKER_REGISTRY:-rast53}
IMAGE_NAME=${DOCKER_IMAGE:-ra-app-bot}

echo "Используемые переменные:"
echo "VERSION: $VERSION"
echo "DOCKER_HUB_USERNAME: $DOCKER_HUB_USERNAME"
echo "IMAGE_NAME: $IMAGE_NAME"

# Сборка образа
echo "Сборка образа $DOCKER_HUB_USERNAME/$IMAGE_NAME:$VERSION..."
docker build -t $DOCKER_HUB_USERNAME/$IMAGE_NAME:$VERSION .

# Проверка успешности сборки
if [ $? -ne 0 ]; then
  echo "Ошибка при сборке образа"
  exit 1
fi

echo "Образ успешно собран"

# Авторизация в Docker Hub (если необходимо)
echo "Авторизация в Docker Hub..."
docker login

# Проверка успешности авторизации
if [ $? -ne 0 ]; then
  echo "Ошибка при авторизации в Docker Hub"
  exit 1
fi

# Отправка образа в Docker Hub
echo "Отправка образа в Docker Hub..."
docker push $DOCKER_HUB_USERNAME/$IMAGE_NAME:$VERSION

# Проверка успешности отправки
if [ $? -ne 0 ]; then
  echo "Ошибка при отправке образа в Docker Hub"
  exit 1
fi

echo "Образ успешно отправлен в Docker Hub: $DOCKER_HUB_USERNAME/$IMAGE_NAME:$VERSION"

# Также отправляем образ с тегом latest, если версия не latest
if [ "$VERSION" != "latest" ]; then
  echo "Создание тега latest..."
  docker tag $DOCKER_HUB_USERNAME/$IMAGE_NAME:$VERSION $DOCKER_HUB_USERNAME/$IMAGE_NAME:latest
  
  echo "Отправка образа с тегом latest в Docker Hub..."
  docker push $DOCKER_HUB_USERNAME/$IMAGE_NAME:latest
  
  if [ $? -ne 0 ]; then
    echo "Ошибка при отправке образа с тегом latest в Docker Hub"
    exit 1
  fi
  
  echo "Образ с тегом latest успешно отправлен в Docker Hub: $DOCKER_HUB_USERNAME/$IMAGE_NAME:latest"
fi

echo "Скрипт успешно завершен."
exit 0 