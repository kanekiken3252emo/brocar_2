/**
 * Нормализует остаток поставщика без потери значений вида `>100`, `>=100`
 * и `100+`. Для таких ответов сохраняем безопасную нижнюю границу и отдельный
 * признак, чтобы интерфейс показывал `100+`, а не выбрасывал склад целиком.
 *
 * @param {unknown} value
 * @returns {{ stock: number, availableMore: boolean }}
 */
export function parseSupplierStock(value) {
  if (typeof value === "number") {
    return {
      stock: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0,
      availableMore: false,
    };
  }

  if (typeof value !== "string") {
    return { stock: 0, availableMore: false };
  }

  const normalized = value.trim().replace(/[\s\u00a0]+/g, "");
  const lowerBound = normalized.match(/^(?:>=|>|≥)(\d+)$/);
  const suffix = normalized.match(/^(\d+)\+$/);
  const bounded = lowerBound ?? suffix;
  if (bounded) {
    return {
      stock: Math.max(0, Number.parseInt(bounded[1], 10)),
      availableMore: true,
    };
  }

  if (!/^\d+(?:[.,]\d+)?$/.test(normalized)) {
    return { stock: 0, availableMore: false };
  }

  const parsed = Number.parseFloat(normalized.replace(",", "."));
  return {
    stock: Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0,
    availableMore: false,
  };
}
