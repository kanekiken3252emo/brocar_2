-- Гараж пользователя: сохранённые автомобили
CREATE TABLE IF NOT EXISTS vehicles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nickname    TEXT,                       -- произвольное название, напр. «Моя Камри»
  brand       TEXT,                       -- марка, напр. TOYOTA
  model       TEXT,                       -- модель, напр. Camry
  year        INTEGER,                    -- год выпуска
  vin         TEXT,                       -- VIN / номер кузова
  mileage     INTEGER,                    -- текущий пробег, км
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vehicles_user_id_idx ON vehicles (user_id);

-- RLS: пользователь работает только со своими машинами
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select_own" ON vehicles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "vehicles_insert_own" ON vehicles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vehicles_update_own" ON vehicles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vehicles_delete_own" ON vehicles
  FOR DELETE USING (auth.uid() = user_id);
