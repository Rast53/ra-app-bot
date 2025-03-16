# Загружаем переменные окружения из файла .env
$envFile = ".\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "Env:$key" -Value $value
        }
    }
}

# Проверяем наличие переменных
if (-not $env:DOCKER_REGISTRY -or -not $env:DOCKER_IMAGE) {
    Write-Error "Ошибка: Не указаны переменные DOCKER_REGISTRY или DOCKER_IMAGE в файле .env"
    exit 1
}

# Устанавливаем версию образа
$VERSION = if ($env:DOCKER_IMAGE_TAG) { $env:DOCKER_IMAGE_TAG } else { "latest" }

# Собираем образ
Write-Host "Сборка образа $env:DOCKER_REGISTRY/$env:DOCKER_IMAGE:$VERSION..."
docker build -t "$env:DOCKER_REGISTRY/$env:DOCKER_IMAGE:$VERSION" .

# Отправляем образ в Docker Hub
Write-Host "Отправка образа $env:DOCKER_REGISTRY/$env:DOCKER_IMAGE:$VERSION в Docker Hub..."
docker push "$env:DOCKER_REGISTRY/$env:DOCKER_IMAGE:$VERSION"

# Также отправляем образ с тегом latest, если версия не latest
if ($VERSION -ne "latest") {
    Write-Host "Отправка образа $env:DOCKER_REGISTRY/$env:DOCKER_IMAGE:latest в Docker Hub..."
    docker tag "$env:DOCKER_REGISTRY/$env:DOCKER_IMAGE:$VERSION" "$env:DOCKER_REGISTRY/$env:DOCKER_IMAGE:latest"
    docker push "$env:DOCKER_REGISTRY/$env:DOCKER_IMAGE:latest"
}

Write-Host "Готово! Образ $env:DOCKER_REGISTRY/$env:DOCKER_IMAGE:$VERSION успешно собран и отправлен в Docker Hub." 