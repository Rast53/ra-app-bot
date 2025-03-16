#!/bin/bash

# Загружаем переменные окружения
source .env

# Проверяем наличие переменных
if [ -z "$DOCKER_REGISTRY" ] || [ -z "$DOCKER_IMAGE" ]; then
  echo "Ошибка: Не указаны переменные DOCKER_REGISTRY или DOCKER_IMAGE в файле .env"
  exit 1
fi

# Устанавливаем версию образа
VERSION=${DOCKER_IMAGE_TAG:-latest}

# Собираем образ
echo "Сборка образа $DOCKER_REGISTRY/$DOCKER_IMAGE:$VERSION..."
docker build -t $DOCKER_REGISTRY/$DOCKER_IMAGE:$VERSION .

# Отправляем образ в Docker Hub
echo "Отправка образа $DOCKER_REGISTRY/$DOCKER_IMAGE:$VERSION в Docker Hub..."
docker push $DOCKER_REGISTRY/$DOCKER_IMAGE:$VERSION

# Также отправляем образ с тегом latest, если версия не latest
if [ "$VERSION" != "latest" ]; then
  echo "Отправка образа $DOCKER_REGISTRY/$DOCKER_IMAGE:latest в Docker Hub..."
  docker tag $DOCKER_REGISTRY/$DOCKER_IMAGE:$VERSION $DOCKER_REGISTRY/$DOCKER_IMAGE:latest
  docker push $DOCKER_REGISTRY/$DOCKER_IMAGE:latest
fi

echo "Готово! Образ $DOCKER_REGISTRY/$DOCKER_IMAGE:$VERSION успешно собран и отправлен в Docker Hub." 