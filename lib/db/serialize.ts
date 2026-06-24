import { profiles, vehicles } from "@/lib/db/schema";

/**
 * drizzle (camelCase) → snake_case JSON, как исторически отдавал Supabase
 * PostgREST и как ждёт фронтенд (profile.full_name, vehicle.created_at и т.п.).
 * Используется в роутах, переписанных с supabase.from на drizzle (миграция на VK).
 */
export function toProfileResponse(p: typeof profiles.$inferSelect) {
  return {
    id: p.id,
    email: p.email,
    full_name: p.fullName,
    phone: p.phone,
    avatar_url: p.avatarUrl,
    contact_email: p.contactEmail,
    telegram: p.telegram,
    whatsapp: p.whatsapp,
    vk: p.vk,
    max_messenger: p.maxMessenger,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function toVehicleResponse(v: typeof vehicles.$inferSelect) {
  return {
    id: v.id,
    user_id: v.userId,
    nickname: v.nickname,
    brand: v.brand,
    model: v.model,
    year: v.year,
    vin: v.vin,
    mileage: v.mileage,
    created_at: v.createdAt,
    updated_at: v.updatedAt,
  };
}
