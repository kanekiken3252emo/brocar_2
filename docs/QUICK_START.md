# 🚀 Быстрый старт - JWT Авторизация в BroCar

## За 5 минут до работающей авторизации

### 1️⃣ Настройка Supabase (2 минуты)

```bash
# 1. Зайдите на https://supabase.com и создайте проект
# 2. Скопируйте URL и anon key
# 3. Обновите .env.local:

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2️⃣ Создание таблиц БД (1 минута)

Откройте **Supabase SQL Editor** и выполните:

```bash
1. Запустите: supabase-schema.sql
2. Запустите: supabase-auth-schema.sql
```

### 3️⃣ Запуск приложения (30 секунд)

```bash
npm install
npm run dev
```

### 4️⃣ Тестирование (1 минута)

1. Откройте http://localhost:3000/auth/register
2. Зарегистрируйте пользователя
3. Войдите через http://localhost:3000/auth/login
4. Откройте http://localhost:3000/dashboard

✅ **Готово! JWT авторизация работает!**

---

## Основные файлы

```
lib/
├── supabase/
│   ├── client.ts          # Клиент для браузера
│   └── server.ts          # Клиент для сервера
├── auth.ts                # Утилиты авторизации
└── api-auth.ts            # Защита API endpoints

app/
├── auth/
│   ├── login/page.tsx     # Страница входа
│   └── register/page.tsx  # Страница регистрации
├── dashboard/page.tsx     # Защищенная страница
├── profile/page.tsx       # Профиль пользователя
└── api/
    ├── auth/signout/      # Выход из системы
    └── profile/           # API профиля (защищено JWT)

components/
└── logout-button.tsx      # Кнопка выхода

middleware.ts              # Защита маршрутов
```

---

## Основные команды

### Проверить авторизацию
```typescript
import { getUser } from "@/lib/auth";
const user = await getUser();
```

### Защитить API endpoint
```typescript
import { withAuth } from "@/lib/api-auth";

export const GET = withAuth(async (request, { user }) => {
  return NextResponse.json({ user_id: user.id });
});
```

### Выход из системы
```typescript
const supabase = createClient();
await supabase.auth.signOut();
```

---

## Что дальше?

📖 Читайте полную документацию: [JWT_AUTH_GUIDE.md](./JWT_AUTH_GUIDE.md)

🔒 Изучите RLS политики в: `supabase-auth-schema.sql`

🛠️ Примеры использования в: `app/api/profile/route.ts`

