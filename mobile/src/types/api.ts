export interface ConductorProperties {
  material: string;
  size_mm2: number;
  size_awg?: string;
  construction: string;
  dc_resistance_20c: number;
  ac_resistance_factor: number;
  temperature_coefficient: number;
}

export interface InsulationProperties {
  material: string;
  thickness_mm: number;
  dielectric_constant: number;
  dielectric_loss_factor: number;
  max_operating_temp: number;
  emergency_temp: number;
  thermal_resistivity: number;
}

export interface SheathProperties {
  material: string;
  thickness_mm: number;
  grounding: string;
}

export interface ArmorProperties {
  armor_type?: string | null;
  material?: string | null;
  thickness_mm?: number | null;
}

export interface JacketProperties {
  material: string;
  thickness_mm: number;
  uv_resistant: boolean;
  temp_rating: number;
  thermal_resistivity: number;
}

export interface CableDimensions {
  overall_diameter_mm: number;
  weight_kg_per_m: number;
  min_bending_radius_mm: number;
}

export interface ThermalProperties {
  thermal_resistance_insulation: number;
  thermal_resistance_jacket: number;
  thermal_capacitance: number;
}

export interface Cable {
  cable_id: string;
  designation: string;
  manufacturer: string;
  voltage_rating_kv: number;
  num_conductors: number;
  cable_type: string;
  conductor: ConductorProperties;
  insulation: InsulationProperties;
  sheath: SheathProperties;
  armor: ArmorProperties;
  jacket: JacketProperties;
  dimensions: CableDimensions;
  thermal: ThermalProperties;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CablePosition {
  cable_id: string;
  position_x: number;
  position_y: number;
  current_load_a: number;
  load_factor: number;
  phase: string;
}

export interface InstallationConfig {
  installation_type: string;
  burial_depth_m: number;
  ambient_temp_c: number;
  soil_thermal_resistivity: number;
  num_rows?: number;
  num_cols?: number;
  duct_inner_diameter_mm?: number;
  duct_spacing_mm?: number;
  concrete_thermal_resistivity?: number;
}

export interface CalculationParameters {
  method: string;
  calculation_type: string;
  duration_hours?: number;
  emergency_factor?: number;
  daily_loss_factor: number;
  transformer_settings: Record<string, unknown>;
}

export interface Project {
  project_id: string;
  name: string;
  description?: string;
  user_id: string;
  installation: InstallationConfig;
  cables: CablePosition[];
  parameters: CalculationParameters;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CalculationResult {
  result_id: string;
  project_id: string;
  cable_temperatures: Array<Record<string, unknown>>;
  ampacity_values: Array<Record<string, unknown>>;
  mutual_heating: number[][];
  hotspot_info: Record<string, unknown>;
  time_series?: Array<Record<string, unknown>>;
  emergency_rating?: Record<string, unknown>;
  calculation_method: string;
  calculation_time_ms: number;
  dtr_results?: Record<string, unknown>;
  created_at: string;
}

export interface MobileStats {
  project_count: number;
  calculation_count: number;
  cable_count: number;
  recent_projects: Project[];
}

export interface CableCreatePayload {
  designation: string;
  manufacturer: string;
  voltage_rating_kv: number;
  num_conductors: number;
  cable_type: string;
  conductor?: Partial<ConductorProperties>;
  insulation?: Partial<InsulationProperties>;
  sheath?: Partial<SheathProperties>;
  armor?: Partial<ArmorProperties>;
  jacket?: Partial<JacketProperties>;
  dimensions?: Partial<CableDimensions>;
  thermal?: Partial<ThermalProperties>;
}

export interface ProjectCreatePayload {
  name: string;
  description?: string;
  installation: InstallationConfig;
  cables: CablePosition[];
  parameters: CalculationParameters;
}

export interface AIMessage {
  message_id: string;
  owner_id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AIHistoryResponse {
  session_id: string;
  messages: AIMessage[];
}

export interface AIChatResponse {
  session_id: string;
  assistant_message: string;
  messages: AIMessage[];
}
