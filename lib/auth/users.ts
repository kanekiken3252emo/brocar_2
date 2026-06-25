/**
 * Слой данных локальной авторизации (таблицы auth_users / auth_tokens в VK).
 * Здесь только работа с БД через drizzle — без HTTP и без логики паролей.
 */
import { db } from "@/lib/db";
import { authUsers, authTokens } from "@/lib/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";

/** Нормализуем email: без пробелов, нижний регистр (храним и ищем так же). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string) {
  return db.query.authUsers.findFirst({
    where: eq(authUsers.email, normalizeEmail(email)),
  });
}

export async function findUserById(id: string) {
  return db.query.authUsers.findFirst({ where: eq(authUsers.id, id) });
}

/**
 * Создаёт пользователя. emailConfirmedAt=null → почта ещё не подтверждена.
 * onConflict по email — чтобы гонка двух регистраций не падала 500-кой; вернёт
 * undefined, если email уже занят (вызывающий покажет «уже существует»).
 */
export async function createUser(input: {
  email: string;
  passwordHash: string;
  emailConfirmedAt?: Date | null;
}) {
  const [row] = await db
    .insert(authUsers)
    .values({
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      emailConfirmedAt: input.emailConfirmedAt ?? null,
    })
    .onConflictDoNothing({ target: authUsers.email })
    .returning();
  return row; // undefined, если email уже занят
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await db
    .update(authUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(authUsers.id, userId));
}

/** Помечает email подтверждённым (если ещё не был). */
export async function confirmUserEmail(userId: string) {
  await db
    .update(authUsers)
    .set({ emailConfirmedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(authUsers.id, userId), isNull(authUsers.emailConfirmedAt)));
}

// ── Токены писем ────────────────────────────────────────────────────────────

/**
 * Создаёт одноразовый токен. Перед этим гасит прежние НЕиспользованные токены
 * того же типа у пользователя — чтобы старая ссылка из письма перестала работать,
 * когда запросили новую.
 */
export async function createAuthToken(input: {
  userId: string;
  type: "confirm" | "reset";
  tokenHash: string;
  expiresAt: Date;
}) {
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.userId, input.userId),
        eq(authTokens.type, input.type),
        isNull(authTokens.usedAt)
      )
    );

  await db.insert(authTokens).values({
    userId: input.userId,
    type: input.type,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
  });
}

/** Находит живой (не использованный, не истёкший) токен по хешу. */
export async function findValidToken(tokenHash: string, type: "confirm" | "reset") {
  return db.query.authTokens.findFirst({
    where: and(
      eq(authTokens.tokenHash, tokenHash),
      eq(authTokens.type, type),
      isNull(authTokens.usedAt),
      gt(authTokens.expiresAt, new Date())
    ),
  });
}

export async function markTokenUsed(id: number) {
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, id));
}
