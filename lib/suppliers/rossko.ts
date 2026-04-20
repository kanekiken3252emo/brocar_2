import axios from "axios";
import type { SupplierAdapter, SearchParams, SupplierItem } from "./adapter";

/**
 * ROSSKO SOAP API adapter
 * Documentation: http://api.rossko.ru
 * Endpoint: http://api.rossko.ru/service/v2.1/GetSearch
 *
 * Requires two auth keys (KEY1, KEY2) and delivery/address context.
 * Default context: самовывоз, Екатеринбург (attached to the account).
 */
export class RosskoAdapter implements SupplierAdapter {
  private baseUrl: string;
  private key1: string;
  private key2: string;
  private deliveryId: string;
  private addressId: string;

  constructor() {
    this.baseUrl =
      process.env.ROSSKO_API_URL || "http://api.rossko.ru/service/v2.1";
    this.key1 = process.env.ROSSKO_KEY1 || "";
    this.key2 = process.env.ROSSKO_KEY2 || "";
    this.deliveryId = process.env.ROSSKO_DELIVERY_ID || "000000001"; // самовывоз
    this.addressId = process.env.ROSSKO_ADDRESS_ID || "270997"; // Екатеринбург
  }

  async search(params: SearchParams): Promise<SupplierItem[]> {
    if (!this.key1 || !this.key2) {
      console.warn("Rossko API keys not configured");
      return [];
    }

    if (!params.article) {
      console.warn("Rossko API: article is required, skipping search");
      return [];
    }

    const text = params.brand
      ? `${params.brand} ${params.article}`
      : params.article;

    const envelope = buildSoapEnvelope({
      key1: this.key1,
      key2: this.key2,
      text,
      deliveryId: this.deliveryId,
      addressId: this.addressId,
    });

    try {
      const response = await axios.post<string>(
        `${this.baseUrl}/GetSearch`,
        envelope,
        {
          timeout: 15000,
          responseType: "text",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: '"http://api.rossko.ru/GetSearch"',
          },
        }
      );

      return parseSearchResponse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Rossko API error:", {
          status: error.response?.status,
          message: error.message,
        });
      } else {
        console.error("Rossko unexpected error:", error);
      }
      return [];
    }
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSoapEnvelope(input: {
  key1: string;
  key2: string;
  text: string;
  deliveryId: string;
  addressId: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:api="http://api.rossko.ru/">
  <soapenv:Body>
    <api:GetSearch>
      <KEY1>${escapeXml(input.key1)}</KEY1>
      <KEY2>${escapeXml(input.key2)}</KEY2>
      <text>${escapeXml(input.text)}</text>
      <delivery_id>${escapeXml(input.deliveryId)}</delivery_id>
      <address_id>${escapeXml(input.addressId)}</address_id>
    </api:GetSearch>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<ns1:${tag}>([\\s\\S]*?)<\\/ns1:${tag}>`)
  );
  return match ? decodeXmlEntities(match[1]) : null;
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`<ns1:${tag}>([\\s\\S]*?)<\\/ns1:${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

function parseSearchResponse(xml: string): SupplierItem[] {
  const success = extractTag(xml, "success");
  if (success !== "true") {
    const message = extractTag(xml, "message");
    if (message) {
      console.warn("Rossko API returned error:", message);
    }
    return [];
  }

  const items: SupplierItem[] = [];

  // PartsList -> Part (без аналогов: берём только первый уровень Part,
  // а crosses блок находится внутри каждого Part и должен быть проигнорирован)
  const partsListBlocks = extractAllBlocks(xml, "PartsList");
  for (const partsListXml of partsListBlocks) {
    // Вырезаем блоки <ns1:crosses>...</ns1:crosses>, чтобы не подхватить
    // аналоги как обычные Part'ы
    const cleaned = partsListXml.replace(
      /<ns1:crosses>[\s\S]*?<\/ns1:crosses>/g,
      ""
    );

    const partBlocks = extractAllBlocks(cleaned, "Part");
    for (const partXml of partBlocks) {
      const brand = extractTag(partXml, "brand") || "";
      const partnumber = extractTag(partXml, "partnumber") || "";
      const name = extractTag(partXml, "name") || "";

      const stocksContainer = extractAllBlocks(partXml, "stocks")[0] || "";
      const stockBlocks = extractAllBlocks(stocksContainer, "stock");

      for (const stockXml of stockBlocks) {
        const price = parseFloat(extractTag(stockXml, "price") || "0");
        const count = parseInt(extractTag(stockXml, "count") || "0", 10);
        const description = extractTag(stockXml, "description") || "склад";
        const type = extractTag(stockXml, "type") || "0";
        const delivery = extractTag(stockXml, "delivery") || "";

        // Берём только обычные предложения (type=0) с ненулевым остатком
        if (count > 0 && price > 0 && type === "0") {
          const deliveryDays = delivery ? parseInt(delivery, 10) : null;
          items.push({
            article: partnumber,
            brand,
            name,
            price,
            stock: count,
            supplier: `Rossko (${description})`,
            supplierCode: "rossko",
            deliveryDays,
            raw: {
              stock_id: extractTag(stockXml, "id"),
              delivery_days: delivery ? parseInt(delivery, 10) : null,
              multiplicity: parseInt(
                extractTag(stockXml, "multiplicity") || "1",
                10
              ),
              delivery_start: extractTag(stockXml, "deliveryStart"),
              delivery_end: extractTag(stockXml, "deliveryEnd"),
            },
          });
        }
      }
    }
  }

  return items;
}

const rosskoAdapter = new RosskoAdapter();

export default rosskoAdapter;
