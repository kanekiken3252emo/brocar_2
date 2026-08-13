import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  searchAllSuppliers,
  groupOffers,
  dedupeGroups,
  mergeFamilyGroups,
  compareGroupsByDelivery,
  normalizeArticle,
  type SupplierItem,
} from "@/lib/suppliers/adapter";
import bergAdapter from "@/lib/suppliers/berg";
import rosskoAdapter from "@/lib/suppliers/rossko";
import shateMAdapter, { ShateMAdapter } from "@/lib/suppliers/shate-m";
import forumAutoAdapter from "@/lib/suppliers/forum-auto";
import armtekAdapter from "@/lib/suppliers/armtek";
import autotradeAdapter from "@/lib/suppliers/autotrade";
import partKomAdapter from "@/lib/suppliers/partkom";
import { applyPricingSync } from "@/lib/pricing";
import { enrichGroupsWithImages } from "@/lib/product-images";
import { brandFamilyId } from "@/lib/brands/families.mjs";

const searchSchema = z.object({
  article: z.string().optional(),
  brand: z.string().optional(),
  // Поиск «как у Армтек»: к точному артикулу добавить ЗАМЕНИТЕЛИ других
  // брендов (кроссы ShATE-M) — выдача не «Найдено: 1», а оригинал + аналоги.
  withAnalogs: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = searchSchema.parse(body);

    if (!validatedData.article && !validatedData.brand) {
      return NextResponse.json(
        { error: "At least one of article or brand is required" },
        { status: 400 }
      );
    }

    const adapters = [
      bergAdapter,
      rosskoAdapter,
      shateMAdapter,
      forumAutoAdapter,
      armtekAdapter,
      autotradeAdapter,
      partKomAdapter,
    ];
    // Основной поиск + (для withAnalogs) поиск articleId в ШАТЕ-М параллельно.
    const [items, shateArticleId] = await Promise.all([
      searchAllSuppliers(adapters, {
        article: validatedData.article,
        brand: validatedData.brand,
        // Кроссы Rossko/Berg — заменители прямо в выдаче поиска.
        withCrosses: validatedData.withAnalogs,
      }),
      validatedData.withAnalogs && validatedData.article
        ? (shateMAdapter as ShateMAdapter)
            .findArticleId(validatedData.article, validatedData.brand)
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    // Заменители по кроссам ШАТЕ-М — оригинал + аналоги в одной выдаче.
    let allItems: SupplierItem[] = items;
    if (shateArticleId) {
      const analogItems = await (shateMAdapter as ShateMAdapter)
        .searchWithAnalogsById(shateArticleId)
        .catch(() => [] as SupplierItem[]);
      allItems = [...items, ...analogItems];
    }

    // «Один артикул + один концерн = одна карточка»: PSA / PEUGEOT/CITROEN /
    // Citroen с тем же номером объединяются со всеми предложениями.
    let groups = mergeFamilyGroups(
      dedupeGroups(
        groupOffers(allItems, (base, ctx) => applyPricingSync(base, ctx))
      )
    );

    // Точный артикул (оригинал и его двойники) — первым, заменители следом
    // по скорости поставки. Клиент сохраняет этот порядок («Сначала подходящие»).
    if (validatedData.withAnalogs && validatedData.article) {
      const na = normalizeArticle(validatedData.article);
      // Внутри точного артикула ОРИГИНАЛ концерна (бренд из таблицы семейств)
      // идёт выше noname-двойников («КИТАЙ», «OEM», «PRC» с тем же номером).
      const exact = groups
        .filter((g) => g.article === na)
        .sort(
          (a, b) =>
            (brandFamilyId(b.brand) !== null ? 1 : 0) -
            (brandFamilyId(a.brand) !== null ? 1 : 0)
        );
      const rest = groups
        .filter((g) => g.article !== na)
        .sort(compareGroupsByDelivery);
      groups = [...exact, ...rest];
    }

    // Подсеваем картинки из кэша product_images, чтобы клиент не делал
    // N round-trip'ов к /api/product-image при рендере грида карточек.
    const enriched = await enrichGroupsWithImages(groups);

    return NextResponse.json({
      groups: enriched,
      count: enriched.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Supplier search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




