-- Разделяет автоматический выбор основного предложения и осознанный выбор
-- конкретного оффера. Старые строки считаются основными: это сохраняет
-- согласованность цены карточки, корзины и оформления.

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS selection_mode text NOT NULL DEFAULT 'primary';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cart_items_selection_mode_check'
  ) THEN
    ALTER TABLE cart_items
      ADD CONSTRAINT cart_items_selection_mode_check
      CHECK (selection_mode IN ('primary', 'fixed'));
  END IF;
END $$;
