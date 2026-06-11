/**
 * Анимация «товар улетает в корзину»: от кнопки добавления к иконке
 * корзины в хедере летит оранжевый кружок с иконкой корзины по дуге,
 * уменьшаясь и затухая. В конце кнопка корзины «подпрыгивает».
 *
 * Целевой элемент ищется по id="header-cart-target" (кнопка КОРЗИНА в хедере).
 * Если его нет на странице или пользователь включил prefers-reduced-motion —
 * анимация просто не играется, добавление работает как раньше.
 */

const CART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`;

/**
 * Сообщает бейджу счётчика в хедере, что товар «долетел» — тот сразу
 * оптимистично увеличивает цифру, не дожидаясь ответа сервера.
 */
function dispatchLanded(qty: number): void {
  window.dispatchEvent(new CustomEvent("cart:landed", { detail: { qty } }));
}

export function flyToCart(source: HTMLElement | null, qty = 1): void {
  if (typeof window === "undefined") return;
  // Анимация невозможна — «приземляем» сразу, чтобы счётчик всё равно
  // обновился мгновенно.
  if (!source || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (typeof window !== "undefined") dispatchLanded(qty);
    return;
  }

  const target = document.getElementById("header-cart-target");
  if (!target) {
    dispatchLanded(qty);
    return;
  }

  const s = source.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  // Кнопка может быть скрыта (display:none на мобильном меню) — не летим в (0,0)
  if (t.width === 0 && t.height === 0) {
    dispatchLanded(qty);
    return;
  }

  const startX = s.left + s.width / 2;
  const startY = s.top + s.height / 2;
  const dx = t.left + t.width / 2 - startX;
  const dy = t.top + t.height / 2 - startY;

  const ball = document.createElement("div");
  ball.setAttribute("aria-hidden", "true");
  ball.style.cssText = [
    "position:fixed",
    `left:${startX - 16}px`,
    `top:${startY - 16}px`,
    "width:32px",
    "height:32px",
    "border-radius:9999px",
    "background:#f97316",
    "box-shadow:0 4px 14px rgba(249,115,22,.5)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "z-index:9999",
    "pointer-events:none",
  ].join(";");
  ball.innerHTML = CART_SVG;
  document.body.appendChild(ball);

  // Дуга: в середине пути приподнимаем траекторию вверх
  const lift = Math.min(120, Math.abs(dx) * 0.25 + 60);
  const anim = ball.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      {
        transform: `translate(${dx * 0.5}px,${dy * 0.5 - lift}px) scale(0.8)`,
        opacity: 0.95,
        offset: 0.55,
      },
      { transform: `translate(${dx}px,${dy}px) scale(0.3)`, opacity: 0.4 },
    ],
    { duration: 650, easing: "cubic-bezier(.3,.6,.4,1)" }
  );

  let landedFired = false;
  const land = () => {
    if (landedFired) return;
    landedFired = true;
    dispatchLanded(qty);
  };

  anim.onfinish = () => {
    ball.remove();
    land();
    // «Подпрыгивание» кнопки корзины при приёме товара
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.18)" },
        { transform: "scale(1)" },
      ],
      { duration: 280, easing: "ease-out" }
    );
  };
  // Подстраховка: если вкладку свернули и onfinish не пришёл
  setTimeout(() => {
    ball.remove();
    land();
  }, 1500);
}
