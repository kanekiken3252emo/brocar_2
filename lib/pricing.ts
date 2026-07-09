import { db } from "./db";
import { priceRules } from "./db/schema";
import { eq } from "drizzle-orm";

interface PricingOptions {
  brand?: string;
  category?: string;
}

/**
 * Единая наценка 38% на все товары — запрос владельца (июль 2026): «чтобы цены
 * у всех поставщиков были с наценкой 38%». До этого была ступенчатая по
 * диапазонам закупки: 52/45/42/40/38/35% (<100/<500/<1000/<10000/<40000/≥40000 ₽).
 *
 * ⚠️ Наценка продублирована в applyMarkup() пяти импортёров (scripts/import-*.mjs) —
 * менять СИНХРОННО, иначе цена карточки разойдётся с ценой каталога из БД.
 */
export function tieredMarkupMultiplier(_base: number): number {
  return 1.38;
}

/** Применяет ступенчатую наценку и округляет до целых рублей. */
export function applyTieredMarkup(base: number): number {
  return Math.round(base * tieredMarkupMultiplier(base));
}

/**
 * Apply pricing rules to a base supplier price
 * Returns the final price after applying markup rules
 */
export async function applyPricing(
  basePrice: number,
  opts: PricingOptions = {}
): Promise<number> {
  try {
    // Fetch active pricing rules
    const activeRules = await db
      .select()
      .from(priceRules)
      .where(eq(priceRules.active, true));

    // Find matching rule (prioritize brand match, then category, then generic)
    let matchedRule = null;

    if (opts.brand) {
      matchedRule = activeRules.find(
        (rule) => rule.brand?.toLowerCase() === opts.brand?.toLowerCase()
      );
    }

    if (!matchedRule && opts.category) {
      matchedRule = activeRules.find(
        (rule) => rule.category?.toLowerCase() === opts.category?.toLowerCase()
      );
    }

    // Apply matched rule or default
    let finalPrice: number;

    if (matchedRule) {
      const pct = parseFloat(matchedRule.pct);
      const minMargin = matchedRule.minMargin
        ? parseFloat(matchedRule.minMargin)
        : 0;

      finalPrice = basePrice * (1 + pct / 100);

      // Ensure minimum margin if specified
      if (minMargin > 0 && finalPrice - basePrice < minMargin) {
        finalPrice = basePrice + minMargin;
      }
    } else {
      // Дефолт: ступенчатая наценка по диапазонам цены
      finalPrice = applyTieredMarkup(basePrice);
    }

    // Round to whole rubles
    return Math.round(finalPrice);
  } catch (error) {
    console.error("Error applying pricing rules:", error);
    // Fallback on error: ступенчатая наценка
    return applyTieredMarkup(basePrice);
  }
}

/**
 * Synchronous version (for bulk operations / live supplier search).
 * Ступенчатая наценка по диапазонам закупочной цены.
 */
export function applyPricingSync(
  basePrice: number,
  _opts: PricingOptions = {}
): number {
  return applyTieredMarkup(basePrice);
}




