# 🔐 JWT Авторизация в BroCar - Полное руководство

## Содержание
1. [Обзор системы](#обзор-системы)
2. [Архитектура](#архитектура)
3. [Настройка](#настройка)
4. [Использование](#использование)
5. [API Endpoints](#api-endpoints)
6. [Примеры кода](#примеры-кода)
7. [Row Level Security (RLS)](#row-level-security-rls)
8. [Безопасность](#безопасность)

---

## Обзор системы

BroCar использует **Supabase Auth** для JWT авторизации. Это означает:

- ✅ **JWT токены генерируются автоматически** при входе
- ✅ **Токены хранятся в httpOnly cookies** для безопасности
- ✅ **Автоматическое обновление токенов** (refresh tokens)
- ✅ **Row Level Security (RLS)** защищает данные на уровне PostgreSQL
- ✅ **Middleware автоматически проверяет JWT** на защищенных маршрутах

---

## Архитектура

```
┌─────────────────┐
│   Клиент (Web)  │
│  Next.js 15     │
└────────┬────────┘
         │ JWT Token (httpOnly cookie)
         │
         ▼
┌─────────────────┐
│   Middleware    │◄──── Проверка JWT на защищенных маршрутах
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase Auth  │◄──── Валидация JWT токена
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL +   │◄──── RLS политики фильтруют данные
│  Row Level Sec  │
└─────────────────┘
```

### Как работает JWT в нашем проекте:

1. **Пользователь входит** → `POST /auth/login`
2. **Supabase генерирует JWT** с данными пользователя
3. **JWT сохраняется в httpOnly cookie** (безопасно)
4. **Каждый запрос** → Middleware проверяет JWT
5. **PostgreSQL получает JWT** → RLS политики фильтруют данные

---

## Настройка

### 1. Создание проекта в Supabase

1. Зайдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Скопируйте **URL** и **anon key**

### 2. Настройка переменных окружения

Создайте файл `.env.local`:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Public Supabase (для клиента)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Database
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### 3. Применение схемы БД

Запустите SQL скрипты в Supabase SQL Editor:

```bash
# 1. Базовая схема
supabase-schema.sql

# 2. Схема авторизации с RLS
supabase-auth-schema.sql
```

---

## Использование

### На клиенте (Client Component)

```typescript
"use client";

import { createClient } from "@/lib/supabase/client";

export function MyComponent() {
  const supabase = createClient();

  // Вход
  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "user@example.com",
      password: "password123",
    });
  };

  // Выход
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Получить текущего пользователя
  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    console.log(user); // { id, email, ... }
  };

  return <div>...</div>;
}
```

### На сервере (Server Component)

```typescript
import { createClient } from "@/lib/supabase/server";
import { getUser, getSession } from "@/lib/auth";

export default async function ServerPage() {
  // Способ 1: Через утилиту
  const user = await getUser();

  // Способ 2: Напрямую через Supabase
  const supabase = await createClient();
  const { data: { user: user2 } } = await supabase.auth.getUser();

  // Получить сессию (включает JWT токен)
  const session = await getSession();
  console.log(session?.access_token); // JWT токен

  return <div>Привет, {user?.email}</div>;
}
```

### В API Routes (защищенные)

```typescript
import { withAuth } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";

// Защищенный endpoint
export const GET = withAuth(async (request, { user }) => {
  // user - автоматически извлечен из JWT
  console.log(user.id, user.email);

  return NextResponse.json({
    message: "Protected data",
    user_id: user.id,
  });
});
```

### В API Routes (опциональная авторизация)

```typescript
import { withOptionalAuth } from "@/lib/api-auth";

export const GET = withOptionalAuth(async (request, { user }) => {
  if (user) {
    // Пользователь авторизован
    return NextResponse.json({ data: "Premium content" });
  } else {
    // Гость
    return NextResponse.json({ data: "Public content" });
  }
});
```

---

## API Endpoints

### Авторизация

#### `POST /api/auth/signout`
Выход из системы (удаляет JWT cookie)

```bash
curl -X POST http://localhost:3000/api/auth/signout \
  -H "Cookie: sb-access-token=..."
```

**Ответ:**
```json
{
  "message": "Successfully signed out"
}
```

---

### Профиль пользователя

#### `GET /api/profile`
Получить профиль текущего пользователя (защищено JWT)

```bash
curl http://localhost:3000/api/profile \
  -H "Cookie: sb-access-token=..."
```

**Ответ:**
```json
{
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Иван Иванов",
    "phone": "+7 900 123 45 67",
    "avatar_url": null
  }
}
```

#### `PATCH /api/profile`
Обновить профиль пользователя (защищено JWT)

```bash
curl -X PATCH http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{
    "full_name": "Новое Имя",
    "phone": "+7 900 999 99 99"
  }'
```

---

### Заказы

#### `GET /api/order`
Получить заказы текущего пользователя (защищено JWT + RLS)

```bash
curl http://localhost:3000/api/order \
  -H "Cookie: sb-access-token=..."
```

**Ответ:**
```json
{
  "orders": [
    {
      "id": 1,
      "user_id": "uuid",
      "status": "paid",
      "total": "5999.99",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

## Примеры кода

### Регистрация нового пользователя

```typescript
// app/auth/register/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const handleRegister = async (email: string, password: string) => {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: "Иван Иванов", // Дополнительные данные
        },
      },
    });

    if (error) {
      console.error("Registration error:", error.message);
      return;
    }

    // При регистрации автоматически создается профиль (см. trigger в БД)
    console.log("User registered:", data.user);
  };

  return <form>...</form>;
}
```

### Защита страницы

```typescript
// app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div>
      <h1>Добро пожаловать, {user.email}</h1>
    </div>
  );
}
```

### Создание защищенного API endpoint

```typescript
// app/api/my-data/route.ts
import { withAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const GET = withAuth(async (request, { user }) => {
  const supabase = await createClient();

  // RLS автоматически фильтрует данные по user.id
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id);

  return NextResponse.json({ data });
});
```

---

## Row Level Security (RLS)

### Что такое RLS?

**Row Level Security** - это механизм PostgreSQL, который автоматически фильтрует строки в таблице на основе JWT токена пользователя.

### Как это работает?

1. **JWT токен содержит `user_id`**
2. **PostgreSQL извлекает `user_id` из токена** через функцию `auth.uid()`
3. **RLS политики фильтруют данные** на основе этого `user_id`

### Пример RLS политики

```sql
-- Пользователи могут видеть только свои заказы
CREATE POLICY "Users can view own orders"
  ON orders
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Что это значит:**
- Когда вы делаете `SELECT * FROM orders`
- PostgreSQL **автоматически** добавляет `WHERE user_id = auth.uid()`
- Пользователь **физически не может** получить чужие данные

### Включенные RLS политики в BroCar

#### Profiles (профили)
- ✅ Пользователь может читать свой профиль
- ✅ Пользователь может обновлять свой профиль

#### Orders (заказы)
- ✅ Пользователь видит только свои заказы
- ✅ Пользователь может создавать заказы для себя
- ✅ Пользователь может обновлять свои заказы

#### Carts (корзины)
- ✅ Пользователь видит только свою корзину
- ✅ Поддержка гостевых корзин (через `session_id`)

#### Cart Items (товары в корзине)
- ✅ Пользователь управляет только своей корзиной

---

## Безопасность

### 🔒 Что мы делаем правильно:

1. **httpOnly cookies** - JWT токен недоступен из JavaScript (защита от XSS)
2. **RLS политики** - данные защищены на уровне БД
3. **Автоматическое обновление токенов** - Supabase обновляет JWT автоматически
4. **Middleware** - проверяет JWT на каждом запросе
5. **Валидация на сервере** - никогда не доверяем клиенту

### 🛡️ Best Practices:

#### ❌ НЕ ДЕЛАЙТЕ ТАК:
```typescript
// app/api/orders/route.ts
export async function GET() {
  // Опасно! Возвращает ВСЕ заказы
  const orders = await db.select().from(orders);
  return NextResponse.json(orders);
}
```

#### ✅ ДЕЛАЙТЕ ТАК:
```typescript
export const GET = withAuth(async (request, { user }) => {
  // Безопасно! RLS автоматически фильтрует
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("*");
  return NextResponse.json(data);
});
```

### Проверка JWT токена вручную

Если вам нужно вручную проверить JWT:

```typescript
import { createClient } from "@/lib/supabase/server";

async function verifyToken() {
  const supabase = await createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { valid: false, error: "Invalid token" };
  }
  
  return { valid: true, user };
}
```

---

## Структура JWT токена

Supabase JWT токен содержит:

```json
{
  "aud": "authenticated",
  "exp": 1735344000,
  "iat": 1735340400,
  "sub": "user-uuid-here",
  "email": "user@example.com",
  "phone": "",
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  },
  "user_metadata": {
    "full_name": "Иван Иванов"
  },
  "role": "authenticated"
}
```

**Важно:**
- `sub` - это `user_id`
- `exp` - время истечения токена (обычно 1 час)
- `role` - роль пользователя (для RLS)

---

## Отладка

### Проверить авторизацию

```typescript
import { getSession } from "@/lib/auth";

const session = await getSession();
console.log("JWT Token:", session?.access_token);
console.log("User ID:", session?.user?.id);
console.log("Expires at:", new Date(session?.expires_at || 0));
```

### Логировать все JWT запросы

Добавьте в `middleware.ts`:

```typescript
export async function middleware(request: NextRequest) {
  const token = request.cookies.get("sb-access-token");
  console.log("JWT Token present:", !!token);
  
  // ... остальной код
}
```

---

## Часто задаваемые вопросы (FAQ)

### Q: Где хранится JWT токен?
A: В httpOnly cookie `sb-access-token`. Он автоматически отправляется с каждым запросом.

### Q: Как долго действует JWT токен?
A: Обычно 1 час. Supabase автоматически обновляет его через refresh token.

### Q: Можно ли получить JWT токен на клиенте?
A: Да, через `supabase.auth.getSession()`, но он также хранится в httpOnly cookie.

### Q: Что если токен истек?
A: Supabase автоматически обновляет токен через refresh token. Middleware обрабатывает это автоматически.

### Q: Как защитить API endpoint?
A: Используйте `withAuth()` или `withOptionalAuth()` из `@/lib/api-auth`.

### Q: Нужно ли вручную проверять JWT в API?
A: Нет! RLS политики автоматически проверяют JWT на уровне БД.

---

## Поддержка

Если у вас возникли проблемы:

1. Проверьте `.env.local` - все ключи заполнены?
2. Проверьте Supabase Dashboard - таблицы созданы?
3. Проверьте RLS - политики включены?
4. Посмотрите логи в консоли браузера
5. Проверьте Network tab - JWT токен отправляется?

---

## Заключение

Вы настроили полноценную JWT авторизацию с:
- ✅ Автоматической генерацией и проверкой JWT
- ✅ Row Level Security для защиты данных
- ✅ Middleware для защиты маршрутов
- ✅ API утилитами для защиты endpoints
- ✅ Компонентами профиля и авторизации

**Ваши данные защищены на уровне базы данных! 🔒**

