import "server-only";
import { createHash } from "crypto";
import { XMLParser } from "fast-xml-parser";

/**
 * Низкоуровневый клиент Laximo (SOAP). Два сервиса:
 *   oem — Laximo.CAT (оригинальные каталоги: VIN → узлы → детали).
 *   am  — Laximo.DOC (aftermarket / база кроссов).
 *
 * Протокол: POST SOAP 1.1, метод QueryDataLogin(request, login, hmac), где
 *   request — команда «Операция:ключ=значение|ключ=значение»,
 *   hmac    — md5(request + пароль).
 * Ответ — экранированный XML внутри <return>. Многие вызовы возвращают ssd —
 * сессионный токен, который нужно прокидывать в следующие вызовы.
 *
 * Ключи — секреты, только на сервере (переменные LAXIMO_CAT_… и LAXIMO_DOC_…).
 */

type Module = "oem" | "am";

const SERVICES: Record<
  Module,
  { url: string; ns: string; loginEnv: string; passEnv: string }
> = {
  oem: {
    url: "http://ws.laximo.ru/ec.Kito.WebCatalog/services/Catalog.CatalogHttpSoap11Endpoint/",
    ns: "http://WebCatalog.Kito.ec",
    loginEnv: "LAXIMO_CAT_LOGIN",
    passEnv: "LAXIMO_CAT_PASSWORD",
  },
  am: {
    url: "http://aws.laximo.ru/ec.Kito.Aftermarket/services/Catalog.CatalogHttpSoap11Endpoint/",
    ns: "http://Aftermarket.Kito.ec",
    loginEnv: "LAXIMO_DOC_LOGIN",
    passEnv: "LAXIMO_DOC_PASSWORD",
  },
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
});

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export class LaximoError extends Error {}

/**
 * Выполняет команду Laximo и возвращает распарсенный внутренний XML (объект
 * `response` из ответа). Бросает LaximoError при SOAP-фолте/сбое.
 */
export async function laximoQuery(
  module: Module,
  command: string
): Promise<Record<string, unknown>> {
  const svc = SERVICES[module];
  const login = process.env[svc.loginEnv];
  const pass = process.env[svc.passEnv];
  if (!login || !pass) {
    throw new LaximoError(`Laximo ${module}: ключи не настроены`);
  }

  const hmac = createHash("md5").update(command + pass).digest("hex");
  const envelope =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${svc.ns}">` +
    `<soap:Body><ns:QueryDataLogin>` +
    `<ns:request>${escXml(command)}</ns:request>` +
    `<ns:login>${escXml(login)}</ns:login>` +
    `<ns:hmac>${hmac}</ns:hmac>` +
    `</ns:QueryDataLogin></soap:Body></soap:Envelope>`;

  let text: string;
  try {
    const res = await fetch(svc.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "urn:QueryDataLogin",
      },
      body: envelope,
      signal: AbortSignal.timeout(25000),
    });
    text = await res.text();
  } catch (e) {
    throw new LaximoError(
      `Laximo ${module}: сеть/таймаут — ${e instanceof Error ? e.message : e}`
    );
  }

  const outer = parser.parse(text) as {
    Envelope?: {
      Body?: {
        Fault?: { faultstring?: string };
        QueryDataLoginResponse?: { return?: string };
      };
    };
  };
  const body = outer?.Envelope?.Body;
  if (body?.Fault) {
    throw new LaximoError(
      `Laximo ${module}: ${body.Fault.faultstring || "SOAP Fault"}`
    );
  }
  const inner = body?.QueryDataLoginResponse?.return;
  if (typeof inner !== "string") {
    throw new LaximoError(`Laximo ${module}: пустой ответ`);
  }

  const parsed = parser.parse(inner) as { response?: Record<string, unknown> };
  return parsed.response ?? {};
}

/** Приводит значение к массиву (fast-xml-parser одиночный элемент даёт объектом). */
export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Подставляет размер в шаблон URL картинки Laximo (…/%size%/…). */
export function laximoImage(url: string | undefined, size = "source"): string | undefined {
  if (!url) return undefined;
  return url.replace(/%size%/g, size);
}
