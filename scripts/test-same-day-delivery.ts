import assert from "node:assert/strict";
// Node.js выполняет TypeScript напрямую и требует явное расширение исходника.
// @ts-expect-error Разрешено только для этого автономного тестового скрипта.
import * as deliveryUtils from "../lib/utils.ts";

const {
  didDeliveryPromiseChange,
  formatDeliveryLabel,
  getEffectiveDeliveryDays,
  getSameDayScheduleId,
} = deliveryUtils;
type DeliveryPromiseContext = Parameters<typeof getSameDayScheduleId>[0];
type SameDayScheduleId = NonNullable<ReturnType<typeof getSameDayScheduleId>>;

function ekb(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute));
}

const monday = [2026, 10, 19] as const;
const saturday = [2026, 10, 24] as const;
const sunday = [2026, 10, 25] as const;

function expectBoundary(
  schedule: SameDayScheduleId,
  date: readonly [number, number, number],
  cutoffHour: number,
  cutoffMinute: number
) {
  const beforeMinute = cutoffMinute === 0 ? 59 : cutoffMinute - 1;
  const beforeHour = cutoffMinute === 0 ? cutoffHour - 1 : cutoffHour;
  const context: DeliveryPromiseContext = { sameDaySchedule: schedule };
  assert.equal(
    getEffectiveDeliveryDays(
      0,
      context,
      ekb(...date, beforeHour, beforeMinute)
    ),
    0,
    `${schedule}: предложение доступно до отсечки`
  );
  assert.equal(
    getEffectiveDeliveryDays(
      0,
      context,
      ekb(...date, cutoffHour, cutoffMinute)
    ),
    1,
    `${schedule}: ровно в момент отсечки срок становится «завтра»`
  );
}

expectBoundary("berg-ekb", monday, 15, 30);
expectBoundary("berg-ekb", saturday, 12, 0);
expectBoundary("armtek-ekb", monday, 17, 0);
expectBoundary("armtek-ekb", saturday, 17, 0);
expectBoundary("rossko-main-ekb", monday, 16, 10);
expectBoundary("rossko-main-ekb", saturday, 16, 10);
expectBoundary("rossko-yasnaya-ekb", monday, 18, 10);
expectBoundary("rossko-yasnaya-ekb", saturday, 14, 10);
expectBoundary("shate-ekb", monday, 12, 30);
expectBoundary("forum-ekt", monday, 13, 0);
expectBoundary("forum-ekt", saturday, 13, 0);
expectBoundary("partkom-7965", monday, 16, 30);
expectBoundary("partkom-7965", saturday, 13, 0);

for (const schedule of [
  "berg-ekb",
  "armtek-ekb",
  "rossko-main-ekb",
  "rossko-yasnaya-ekb",
  "shate-ekb",
  "forum-ekt",
  "partkom-7965",
] satisfies SameDayScheduleId[]) {
  assert.equal(
    getEffectiveDeliveryDays(
      0,
      { sameDaySchedule: schedule },
      ekb(...sunday, 10, 0)
    ),
    1,
    `${schedule}: в воскресенье BroCar закрыт`
  );
}

assert.equal(
  getEffectiveDeliveryDays(
    0,
    { sameDaySchedule: "shate-ekb" },
    ekb(...saturday, 10, 0)
  ),
  1,
  "ShATE: субботняя отсечка не обещается без подтверждённого времени заказа"
);
assert.equal(
  getEffectiveDeliveryDays(
    0,
    { supplierCode: "berg", supplier: "BERG MSK" },
    ekb(...monday, 10, 0)
  ),
  1,
  "удалённый склад известного поставщика не получает обещание «сегодня»"
);
assert.equal(
  getEffectiveDeliveryDays(
    0,
    { supplierCode: "rossko", supplier: "Нижний Тагил" },
    ekb(...monday, 10, 0)
  ),
  1,
  "удалённый склад Rossko не получает обещание «сегодня»"
);
assert.equal(
  getEffectiveDeliveryDays(0, {}, ekb(...monday, 11, 59)),
  0,
  "старый источник сохраняет прежнюю границу до полудня"
);
assert.equal(
  getEffectiveDeliveryDays(0, {}, ekb(...monday, 12, 0)),
  1,
  "старый источник сохраняет прежнюю границу в полдень"
);

assert.equal(
  getSameDayScheduleId({ supplierCode: "berg", supplier: "Berg (BERG EKB)" }),
  "berg-ekb"
);
assert.equal(
  getSameDayScheduleId({
    supplierCode: "partkom",
    supplier: "Склад (Екатеринбург), размещение 7965",
  }),
  "partkom-7965"
);
assert.equal(
  getSameDayScheduleId({
    supplierCode: "shate-m",
    supplier: "ShATE-M (E01)",
  }),
  "shate-ekb"
);
assert.equal(
  formatDeliveryLabel(
    0,
    { sameDaySchedule: "berg-ekb" },
    ekb(...monday, 15, 29)
  ),
  "Доставка сегодня"
);
assert.equal(
  formatDeliveryLabel(
    0,
    { sameDaySchedule: "berg-ekb" },
    ekb(...monday, 15, 30)
  ),
  "Доставка завтра"
);

const berg = { sameDaySchedule: "berg-ekb" } as const;
assert.equal(
  didDeliveryPromiseChange(
    0,
    berg,
    ekb(...monday, 15, 29),
    ekb(...monday, 15, 30)
  ),
  true,
  "переход через отсечку делает строку корзины несвежей"
);
assert.equal(
  didDeliveryPromiseChange(
    0,
    berg,
    ekb(...monday, 14, 0),
    ekb(...monday, 14, 30)
  ),
  false,
  "внутри одного периода обещание не меняется"
);
assert.equal(
  didDeliveryPromiseChange(
    1,
    berg,
    ekb(...monday, 18, 0),
    ekb(2026, 10, 20, 9, 0)
  ),
  true,
  "смена календарного дня делает строку корзины несвежей"
);

console.log("Same-day delivery schedule tests passed");
