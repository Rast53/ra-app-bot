# PowerShell-скрипт для сборки и отправки Docker-образа

# Устанавливаем переменные для сборки
$VERSION = "latest"
$DOCKER_HUB_USERNAME = "rast53"
$IMAGE_NAME = "ra-app-bot"

Write-Host "Используемые переменные:" -ForegroundColor Green
Write-Host "VERSION: $VERSION" -ForegroundColor Cyan
Write-Host "DOCKER_HUB_USERNAME: $DOCKER_HUB_USERNAME" -ForegroundColor Cyan
Write-Host "IMAGE_NAME: $IMAGE_NAME" -ForegroundColor Cyan

# Сборка образа
Write-Host "Сборка образа $DOCKER_HUB_USERNAME/$IMAGE_NAME`:$VERSION..." -ForegroundColor Green
docker build -t "$DOCKER_HUB_USERNAME/$IMAGE_NAME`:$VERSION" .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при сборке образа" -ForegroundColor Red
    exit 1
}

Write-Host "Образ успешно собран" -ForegroundColor Green

# Авторизация в Docker Hub
Write-Host "Авторизация в Docker Hub..." -ForegroundColor Green
docker login

if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при авторизации в Docker Hub" -ForegroundColor Red
    exit 1
}

# Отправка образа в Docker Hub
Write-Host "Отправка образа в Docker Hub..." -ForegroundColor Green
docker push "$DOCKER_HUB_USERNAME/$IMAGE_NAME`:$VERSION"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при отправке образа в Docker Hub" -ForegroundColor Red
    exit 1
}

Write-Host "Образ успешно отправлен в Docker Hub: $DOCKER_HUB_USERNAME/$IMAGE_NAME`:$VERSION" -ForegroundColor Green
Write-Host "Скрипт успешно завершен." -ForegroundColor Green 