# PowerShell-скрипт для сборки и отправки Docker-образа

Write-Host "Запуск скрипта сборки и отправки Docker-образа..." -ForegroundColor Green

# Проверяем наличие Docker
try {
    $dockerVersion = docker --version
    Write-Host "Docker найден: $dockerVersion" -ForegroundColor Green
}
catch {
    Write-Host "Docker не найден. Пожалуйста, установите Docker и попробуйте снова." -ForegroundColor Red
    exit 1
}

# Загружаем переменные из .env файла
if (Test-Path ".env") {
    Write-Host "Загрузка переменных из .env файла..." -ForegroundColor Green
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -and -not $line.StartsWith('#')) {
            $key, $value = $line.Split('=', 2)
            if ($key -and $value) {
                [Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
                Write-Host "Установлена переменная: $key" -ForegroundColor Gray
            }
        }
    }
}
else {
    Write-Host "Файл .env не найден. Будут использованы значения по умолчанию." -ForegroundColor Yellow
}

# Устанавливаем переменные для сборки
$VERSION = if ($env:DOCKER_IMAGE_TAG) { $env:DOCKER_IMAGE_TAG } else { "latest" }
$DOCKER_HUB_USERNAME = if ($env:DOCKER_REGISTRY) { $env:DOCKER_REGISTRY } else { "rast53" }
$IMAGE_NAME = if ($env:DOCKER_IMAGE) { $env:DOCKER_IMAGE } else { "ra-app-bot" }

Write-Host "Используемые переменные:" -ForegroundColor Green
Write-Host "VERSION: $VERSION" -ForegroundColor Cyan
Write-Host "DOCKER_HUB_USERNAME: $DOCKER_HUB_USERNAME" -ForegroundColor Cyan
Write-Host "IMAGE_NAME: $IMAGE_NAME" -ForegroundColor Cyan

# Сборка образа
Write-Host "Сборка образа $($DOCKER_HUB_USERNAME)/$($IMAGE_NAME):$($VERSION)..." -ForegroundColor Green
docker build -t "$($DOCKER_HUB_USERNAME)/$($IMAGE_NAME):$($VERSION)" .

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
docker push "$($DOCKER_HUB_USERNAME)/$($IMAGE_NAME):$($VERSION)"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при отправке образа в Docker Hub" -ForegroundColor Red
    exit 1
}

Write-Host "Образ успешно отправлен в Docker Hub: $($DOCKER_HUB_USERNAME)/$($IMAGE_NAME):$($VERSION)" -ForegroundColor Green

# Также отправляем образ с тегом latest, если версия не latest
if ($VERSION -ne "latest") {
    Write-Host "Создание тега latest..." -ForegroundColor Green
    docker tag "$($DOCKER_HUB_USERNAME)/$($IMAGE_NAME):$($VERSION)" "$($DOCKER_HUB_USERNAME)/$($IMAGE_NAME):latest"
    
    Write-Host "Отправка образа с тегом latest в Docker Hub..." -ForegroundColor Green
    docker push "$($DOCKER_HUB_USERNAME)/$($IMAGE_NAME):latest"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Ошибка при отправке образа с тегом latest в Docker Hub" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Образ с тегом latest успешно отправлен в Docker Hub: $($DOCKER_HUB_USERNAME)/$($IMAGE_NAME):latest" -ForegroundColor Green
}

Write-Host "Скрипт успешно завершен." -ForegroundColor Green 