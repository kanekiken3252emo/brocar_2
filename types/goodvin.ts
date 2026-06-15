/**
 * Типы ответов Catalogs API GoodVin (api.goodvin.net/v1).
 * Соответствуют OpenAPI-схеме из документации поставщика.
 */

/** Доступный каталог (марка/линейка). GET /catalogs/ */
export interface GoodvinCatalog {
  id: string;
  name: string;
  modelsCount: number;
  actuality: string;
  hasUniTree: boolean;
  hasGroupTree: boolean;
  hasVinCheck: boolean;
  hasFrameCheck: boolean;
}

/** Параметр комплектации авто. */
export interface GoodvinCarParameter {
  idx: string;
  key: string;
  name: string;
  value: string;
  sortOrder: number;
}

/** Опциональный код комплектации. */
export interface GoodvinOptionCode {
  code: string;
  description: string;
}

/** Найденный по VIN/FRAME автомобиль. GET /car/info */
export interface GoodvinCarInfo {
  title: string;
  catalogId: string;
  brand: string;
  modelId: string;
  carId: string;
  criteria: string;
  vin: string;
  frame: string;
  modelName: string;
  description: string;
  groupsTreeAvailable: boolean;
  optionCodes?: GoodvinOptionCode[];
  parameters?: GoodvinCarParameter[];
}

/** Узел дерева групп. GET /catalogs/{id}/groups2 */
export interface GoodvinGroup {
  id: string;
  parentId?: string;
  hasSubgroups: boolean;
  hasParts: boolean;
  name: string;
  img?: string;
  description?: string;
}

/** Конкретная деталь внутри схемы. */
export interface GoodvinPart {
  id: string;
  nameId: string;
  name: string;
  number: string;
  notice?: string;
  description?: string;
  positionNumber?: string;
  url?: string;
}

/** Группа деталей на схеме (по позициям). */
export interface GoodvinPartGroup {
  name: string;
  number: string;
  positionNumber: string;
  description?: string;
  parts: GoodvinPart[];
}

/** Позиция (выноска) на изображении схемы. */
export interface GoodvinPartPosition {
  number: string;
  coordinates: number[];
}

/** Схема узла + детали. GET /catalogs/{id}/parts2 */
export interface GoodvinParts {
  img?: string;
  imgDescription?: string;
  brand?: string;
  partGroups: GoodvinPartGroup[];
  positions?: GoodvinPartPosition[];
}

/** Тело ошибки API GoodVin. */
export interface GoodvinError {
  code: number;
  errorCode: string | number;
  message: string;
}
