# Авторизация: переезд с Supabase Auth → своя (local), в VK Москва

**Цель:** последняя часть 152-ФЗ — данные входа (email + хеш пароля) живут в VK
(Москва), а не в Supabase (Ирландия). Авторизацию встроили в сам сайт (отдельный
сервис не поднимаем). Подробнее почему так — см. обсуждение в чате.

**Главный принцип безопасности:** всё переключается ОДНИМ рантайм-флагом
`AUTH_BACKEND`. Supabase остаётся нетронутым как запасной аэродром. Откат =
убрать флаг + перезапуск контейнера (меньше минуты). Данные при этом не теряются.

---

## Что уже сделано в коде (в репозитории)

- Таблицы `auth_users` (email + bcrypt-хеш) и `auth_tokens` (ссылки сброса) —
  схема в [lib/db/schema.ts](../lib/db/schema.ts).
- Ядро: `lib/auth/password.ts` (bcrypt), `session.ts` (JWT-cookie на `jose`),
  `tokens.ts`, `users.ts`, `cookies.ts`, `config.ts`.
- API: `app/api/auth/{login,register,logout,forgot-password,reset-password,mode}`.
- Переключатель чтения: `lib/auth.ts`, `lib/api-auth.ts`, `middleware.ts` —
  читают флаг `AUTH_BACKEND`.
- Переключатель записи: страницы `app/auth/*`, `components/header.tsx`,
  `logout-button`, `profile` — через `lib/auth/client-actions.ts`, режим узнают
  в рантайме у `/api/auth/mode`.
- Письмо «сброс пароля» — `lib/email.ts` → `sendPasswordResetEmail` (наш SMTP).
- Скрипты: `scripts/create-auth-tables.mjs`, `scripts/migrate-auth-users.mjs`.

`bcryptjs` проверяет именно те хеши, которыми шифрует Supabase ($2a$) — поэтому
**старые пароли продолжают подходить** после переноса.

---

## Переменные окружения (в `/var/www/brocar/.env` на VPS)

| Переменная | Значение | Когда |
|---|---|---|
| `AUTH_SECRET` | случайная строка (подписывает cookie сессии) | **до cutover** |
| `AUTH_BACKEND` | `local` | **в момент cutover** |
| `AUTH_REQUIRE_EMAIL_CONFIRM` | `true`/`false` (по умолч. off) | опционально |

`SMTP_*` уже настроены (на них работают письма заказов) — те же используются для
письма сброса. Отдельно ничего добавлять не нужно.

Сгенерировать `AUTH_SECRET` (на VPS):

```
openssl rand -base64 48
```

Вставить в `/var/www/brocar/.env` строкой `AUTH_SECRET=<вставить>`. **Без флага
`AUTH_BACKEND=local` сайт продолжает работать на Supabase** — `AUTH_SECRET` можно
поставить заранее, он не активирует local сам по себе.

---

## Порядок cutover (по шагам)

Все шаги аддитивные и безопасные до самого шага 5. Шаги 2–3 НЕ влияют на живой
сайт (он ещё на Supabase) — просто наполняют VK.

### 1. Выкатить код
Запушить ветку → авто-деплой соберёт образ (поставит `jose`/`bcryptjs`). Убедись,
что деплой прошёл и сайт открывается (он ещё на Supabase — ничего не изменилось).

> Скрипты НЕ лежат в образе — как ночной cron, сначала копируем их в контейнер
> (`docker cp`), потом запускаем по пути `/app/scripts/...`. Env (VK) уже в
> контейнере из env_file. `postgres` берётся из `/app/node_modules` (есть в образе).

### 2. Создать таблицы в VK
Зайти по SSH (`ssh root@217.114.7.83`) и выполнить по очереди:

```
docker exec -u root brocar-app mkdir -p /app/scripts
docker cp /var/www/brocar/scripts/. brocar-app:/app/scripts
docker exec -u root brocar-app node /app/scripts/create-auth-tables.mjs
```

Ждём `🎉 Готово` (auth_users + auth_tokens + индексы).

### 3. Перенести пользователей из Supabase → VK
Нужна строка подключения к Supabase — она сохранена в `/var/www/brocar/.env.bak`
(это бэкап до переезда БД, там `DATABASE_POOLER_URL` = Supabase). Подставь её в
`SOURCE_DB_URL` (скрипты уже скопированы на шаге 2):

```
docker exec -u root -e SOURCE_DB_URL="<строка Supabase из .env.bak>" brocar-app node /app/scripts/migrate-auth-users.mjs
```

В выводе: `Найдено в Supabase: N`, `Перенесено: N`, `Итого в VK auth_users: N`.
Числа должны сойтись. `Без пароля (пропущены)` — это OAuth/без пароля, их мало
или ноль, они потом смогут «сбросить пароль».

> Идемпотентно — можно гонять повторно. **Прогони ещё раз прямо перед шагом 5**,
> чтобы захватить тех, кто зарегистрировался уже после первого прогона.

### 4. (Рекомендую) Проверить локально перед боевым переключением
На своём ПК в `.env.local` временно добавь `AUTH_BACKEND=local` и `AUTH_SECRET=...`,
запусти `npm run dev` и проверь вход СВОИМ боевым аккаунтом (данные уже в VK после
шага 3). Если вход проходит и виден личный кабинет — хеши и сессия рабочие. Убери
флаг из `.env.local` обратно.

### 5. Боевой cutover
В `/var/www/brocar/.env` добавь:

```
AUTH_BACKEND=local
```

(и убедись, что `AUTH_SECRET` уже стоит). Применить:

```
cd /var/www/brocar && docker compose up -d
```

Контейнер перезапустится с local-авторизацией.

### 6. Дымовой тест (сразу после)
- Войти своим аккаунтом (старый пароль должен подойти).
- Зайти на `/dashboard` (должен пустить), `/profile` (грузится).
- Зарегистрировать тестовый новый аккаунт → должен сразу войти.
- «Забыли пароль» на свой email → проверить, что письмо пришло → перейти по
  ссылке → задать новый пароль → войти с новым.
- «Выйти» → разлогинивает.

### 7. Откат (если что-то не так)
Убрать строку `AUTH_BACKEND=local` (или поставить `AUTH_BACKEND=supabase`) и:

```
cd /var/www/brocar && docker compose up -d
```

Сайт мгновенно вернётся на Supabase. Данные в VK остаются, Supabase нетронут.

> Важно: при переключении (туда и обратно) все, кто были залогинены, разлогинятся
> один раз — cookie у Supabase и у нас разные. Снова войдут обычным паролем.

---

## После того как стабильно (отдельной задачей, не сразу)

- Можно удалить из кода Supabase Auth: пакеты `@supabase/ssr`,
  `@supabase/supabase-js`, файлы `lib/supabase/*`, supabase-ветки в
  `lib/auth.ts`/`api-auth.ts`/`middleware.ts`/`client-actions.ts`,
  `app/auth/{callback,confirm}`, `app/api/auth/signout`. Делать ТОЛЬКО после
  нескольких дней уверенной работы local (это и есть «сжечь мосты»).
- После этого → уведомление РКН (всё в РФ).

---

## Заметки на будущее

- Сессия — stateless JWT в httpOnly-cookie `brocar_session`, 30 дней, подпись на
  `AUTH_SECRET`. Логаут просто стирает cookie.
- Подтверждение email новых регистраций по умолчанию ВЫКЛ (вход сразу). Включить:
  `AUTH_REQUIRE_EMAIL_CONFIRM=true` (тогда новый аккаунт сможет войти только после
  письма — а письмо подтверждения в v1 ещё не шлётся, так что включать только
  после доработки confirm-флоу).
- Брутфорс-лимит на /login пока не стоит (bcrypt сам по себе небыстрый). Если
  понадобится — добавить rate-limit. Это известный TODO, не блокер.
