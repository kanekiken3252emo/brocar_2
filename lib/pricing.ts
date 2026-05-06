import { db } from "./db";
import { priceRules } from "./db/schema";
import { eq } from "drizzle-orm";

interface PricingOptions {
  brand?: string;
  category?: string;
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
      // Default pricing: 15% markup or +200 RUB, whichever is higher
      const percentMarkup = basePrice * 1.15;
      const fixedMarkup = basePrice + 200;
      finalPrice = Math.max(percentMarkup, fixedMarkup);
    }

    // Round to whole rubles
    return Math.round(finalPrice);
  } catch (error) {
    console.error("Error applying pricing rules:", error);
    // Fallback to default pricing on error
    const percentMarkup = basePrice * 1.15;
    const fixedMarkup = basePrice + 200;
    return Math.round(Math.max(percentMarkup, fixedMarkup));
  }
}

/**
 * Synchronous version using cached rules (for bulk operations)
 */
export function applyPricingSync(
  basePrice: number,
  _opts: PricingOptions = {}
): number {
  // Default pricing: 15% markup or +200 RUB, whichever is higher
  const percentMarkup = basePrice * 1.15;
  const fixedMarkup = basePrice + 200;
  return Math.round(Math.max(percentMarkup, fixedMarkup));
}




