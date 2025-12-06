// BERG API Types

export interface BergApiError {
  code: string;
  text: string;
}

export interface BergApiResponse<T> {
  data?: T;
  errors?: BergApiError[];
  warnings?: BergApiError[];
}

// Brand
export interface BergBrand {
  id: number;
  name: string;
}

// Resource/Article
export interface BergResource {
  id: number;
  name: string;
  article: string;
  brand: BergBrand;
  offers?: BergOffer[];
  source_idx?: number;
}

// Offer (Price + Stock)
export interface BergWarehouse {
  id: number;
  name: string;
  type: number; // 1 - local, 2 - central, 3 - additional
}

export interface BergAddressTimetable {
  buy_until?: string;
  delivery_from?: string;
  delivery_to?: string;
  pickup_from?: string;
  pickup_to?: string;
}

export interface BergOffer {
  price: number;
  quantity: number;
  available_more: boolean;
  reliability: number; // 0-100
  multiplication_factor: number;
  average_period: number; // days
  assured_period: number; // days
  delivery_type: number; // 1 - normal, 2 - air
  is_transit: boolean;
  warehouse: BergWarehouse;
  address_timetable?: BergAddressTimetable;
}

// Search Request
export interface BergSearchItem {
  resource_id?: number;
  resource_article?: string;
  brand_id?: number;
  brand_name?: string;
}

export interface BergSearchParams {
  items: BergSearchItem[];
  analogs?: 0 | 1;
  warehouse_types?: number[];
  address_id?: number;
}

// Stock Response
export interface BergStockResponse {
  resources: BergResource[];
  warnings?: BergApiError[];
}

// VIN Search
export interface BergVinSearchParams {
  vin: string;
  brand?: string;
}

// Vehicle Search
export interface BergVehicle {
  id: number;
  brand: string;
  model: string;
  modification: string;
  year_from: number;
  year_to: number;
}

// Applicability
export interface BergApplicability {
  vehicle_id: number;
  vehicle_name: string;
  year_from: number;
  year_to: number;
}

// Order
export interface BergOrderItem {
  resource_id: number;
  warehouse_id: number;
  quantity: number;
  delivery_type?: number;
  comment?: string;
  max_price?: number;
  is_transit?: boolean;
}

export interface BergOrder {
  is_test?: 0 | 1;
  reference?: number;
  payment_type?: 1 | 2; // 1 - cash, 2 - non-cash
  dispatch_type: 2 | 3 | 60580; // 2 - pickup, 3 - delivery, 60580 - urgent
  dispatch_at: string; // YYYY-MM-DD
  dispatch_time: 1 | 2; // 1 - before 15:00, 2 - after 15:00
  person?: string;
  phone?: string;
  comment?: string;
  shipment_address?: string;
  shipment_address_id?: number;
  items: BergOrderItem[];
}

// Shipping Address
export interface BergShippingAddress {
  id: number;
  address: string;
  person: string;
  phone: string;
  state: 1 | 2; // 1 - active, 2 - hidden
}

// Order State
export interface BergOrderState {
  id: number;
  name: string;
  type: 0 | 1 | 2; // 0 - normal, 1 - initial, 2 - final
}

