// Types for car search functionality

export interface Brand {
  id: number;
  name: string;
  letter: string;
}

export interface Model {
  id: number;
  brandId: number;
  name: string;
}

export interface Engine {
  id: number;
  name: string;
  volume: string;
  power: number;
  fuel: string;
}

export interface Modification {
  id: number;
  modelId: number;
  name: string;
  generation: string;
  yearFrom: number;
  yearTo: number;
  engines: Engine[];
}

export interface CarSearchState {
  selectedBrand: Brand | null;
  selectedModel: Model | null;
  selectedModification: Modification | null;
  selectedEngine: Engine | null;
  selectedYear: number | null;
  vin: string;
}

