const SUPPLIER_MAP: Record<string, string> = {
  berg: "VEGA 1",
  armtek: "VEGA 2",
  rossko: "VEGA 3",
  "shate-m": "VEGA 4",
  "forum-auto": "VEGA 5",
  autotrade: "VEGA 6",
  partkom: "VEGA 7",
};

let nextIndex = Object.keys(SUPPLIER_MAP).length + 1;
const dynamicMap = new Map<string, string>();

export function getVegaName(supplierCode: string): string {
  const fixed = SUPPLIER_MAP[supplierCode.toLowerCase()];
  if (fixed) return fixed;

  const existing = dynamicMap.get(supplierCode.toLowerCase());
  if (existing) return existing;

  const name = `VEGA ${nextIndex++}`;
  dynamicMap.set(supplierCode.toLowerCase(), name);
  return name;
}
