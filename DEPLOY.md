# 🚀 Как развернуть Brocar на VPS

## Что тебе понадобится
- VPS с Ubuntu (20.04 / 22.04 / 24.04)
- Домен, привязанный к IP твоего VPS
- SSH доступ к серверу

---

## Шаг 1: Подключись к VPS

```bash
ssh root@твой_ip_адрес
```

---

## Шаг 2: Обнови систему и установи нужные пакеты

```bash
# Обновляем систему
apt update && apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Устанавливаем Docker Compose
apt install docker-compose-plugin -y

# Устанавливаем nginx
apt install nginx -y

# Устанавливаем Git
apt install git -y
```

---

## Шаг 3: Создай папку для проекта и загрузи файлы

### Вариант А: Через Git (если проект на GitHub/GitLab)

```bash
cd /var/www
git clone https://github.com/твой-юзер/brocar.git
cd brocar
```

### Вариант Б: Через SFTP (загрузить файлы вручную)

1. Используй FileZilla или WinSCP
2. Подключись к VPS по SFTP (тот же IP и логин/пароль)
3. Создай папку `/var/www/brocar`
4. Загрузи ВСЕ файлы проекта туда

---

## Шаг 4: Создай файл .env на сервере

```bash
cd /var/www/brocar
nano .env
```

Вставь туда свои переменные окружения (из ENV_TEMPLATE.txt или .env.local):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
DATABASE_URL=postgresql://...
# и другие переменные
```

Сохрани: `Ctrl+X`, потом `Y`, потом `Enter`

---

## Шаг 5: Запусти проект через Docker

```bash
cd /var/www/brocar

# Собираем и запускаем контейнер
docker compose up -d --build
```

Подожди 2-5 минут пока соберётся. Проверь что работает:

```bash
# Проверяем статус
docker compose ps

# Смотрим логи (если что-то не так)
docker compose logs -f
```

Проверь что сайт отвечает на порту 3000:
```bash
curl http://localhost:3000
```

---

## Шаг 6: Настрой nginx

```bash
# Копируем конфиг
cp /var/www/brocar/nginx.conf /etc/nginx/sites-available/brocar

# Редактируем - меняем "твой-домен.ru" на свой реальный домен
nano /etc/nginx/sites-available/brocar

# Создаем симлинк
ln -s /etc/nginx/sites-available/brocar /etc/nginx/sites-enabled/

# Удаляем дефолтный конфиг
rm /etc/nginx/sites-enabled/default

# Проверяем конфиг
nginx -t

# Перезапускаем nginx
systemctl restart nginx
```

---

## Шаг 7: Получи SSL сертификат (HTTPS)

```bash
# Устанавливаем certbot
apt install certbot python3-certbot-nginx -y

# Получаем сертификат (замени домен!)
certbot --nginx -d твой-домен.ru -d www.твой-домен.ru
```

Следуй инструкциям на экране. Certbot автоматически настроит nginx для HTTPS.

---

## 🎉 Готово!

Теперь твой сайт должен работать по адресу `https://твой-домен.ru`

---

## Полезные команды

```bash
# Перезапустить приложение
cd /var/www/brocar
docker compose restart

# Обновить приложение (после изменений в коде)
cd /var/www/brocar
git pull                      # если используешь git
docker compose up -d --build  # пересобрать и запустить
# Примечание: в проде это происходит автоматически через
# /usr/local/bin/brocar-deploy.sh — запускается из cron раз в минуту,
# подхватывает новые коммиты из origin/main и пересобирает контейнер.
# Логи деплоя: tail -f /var/log/brocar-deploy.log

# Посмотреть логи
docker compose logs -f

# Остановить приложение
docker compose down

# Проверить статус nginx
systemctl status nginx

# Перезапустить nginx
systemctl restart nginx
```

---

## Если что-то не работает

### Сайт не открывается
1. Проверь что Docker контейнер запущен: `docker compose ps`
2. Проверь логи: `docker compose logs`
3. Проверь что nginx работает: `systemctl status nginx`
4. Проверь что порт 80/443 открыт в файрволе VPS

### Ошибка при билде
1. Проверь логи: `docker compose logs`
2. Убедись что .env файл создан и заполнен
3. Проверь что все файлы загружены

### Не работает API/база данных
1. Проверь переменные окружения в .env
2. Проверь что DATABASE_URL правильный
3. Проверь что Supabase ключи правильные

---

## Структура на сервере

```
/var/www/brocar/
├── .env                 # Секретные переменные
├── Dockerfile           # Инструкция для Docker
├── docker-compose.yml   # Конфиг Docker Compose
├── nginx.conf           # Шаблон для nginx
├── package.json
├── app/
├── components/
├── lib/
└── ... остальные файлы
```
