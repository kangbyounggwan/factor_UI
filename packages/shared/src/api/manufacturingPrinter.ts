import { supabase } from "../integrations/supabase/client";

export interface ManufacturingPrinter {
  id: string;
  manufacturer: string;
  series: string;
  model: string;
  display_name: string;
  filename: string;
  technology?: string;
  build_volume?: {
    x: number;
    y: number;
    z: number;
  };
  extruder_count?: number;
  heated_bed?: boolean;
}

export interface ManufacturerOption {
  manufacturer: string;
}

export interface SeriesOption {
  series: string;
}

export interface ModelOption {
  model: string;
  display_name: string;
  id: string;
}

/**
 * 모든 제조사 목록 가져오기 (중복 제거)
 */
export async function getManufacturers(): Promise<ManufacturerOption[]> {
  const { data, error } = await supabase
    .from('manufacturing_printers')
    .select('manufacturer')
    .eq('visible', true)
    .order('manufacturer');

  if (error) throw error;

  // 중복 제거
  const uniqueManufacturers = Array.from(
    new Set(data?.map(item => item.manufacturer) || [])
  ).map(manufacturer => ({ manufacturer }));

  return uniqueManufacturers;
}

/**
 * 특정 제조사의 시리즈 목록 가져오기 (중복 제거)
 */
export async function getSeriesByManufacturer(manufacturer: string): Promise<SeriesOption[]> {
  const { data, error } = await supabase
    .from('manufacturing_printers')
    .select('series')
    .eq('manufacturer', manufacturer)
    .eq('visible', true)
    .order('series');

  if (error) throw error;

  // 중복 제거
  const uniqueSeries = Array.from(
    new Set(data?.map(item => item.series) || [])
  ).map(series => ({ series }));

  return uniqueSeries;
}

/**
 * 특정 제조사의 특정 시리즈의 모델 목록 가져오기
 */
export async function getModelsByManufacturerAndSeries(
  manufacturer: string,
  series: string
): Promise<ModelOption[]> {
  const { data, error } = await supabase
    .from('manufacturing_printers')
    .select('id, model, display_name')
    .eq('manufacturer', manufacturer)
    .eq('series', series)
    .eq('visible', true)
    .order('model');

  if (error) throw error;

  return data || [];
}

/**
 * 프린터 ID로 상세 정보 가져오기
 */
export async function getManufacturingPrinterById(id: string): Promise<ManufacturingPrinter | null> {
  const { data, error } = await supabase
    .from('manufacturing_printers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data;
}

/**
 * 검색어로 프린터 검색
 */
export async function searchManufacturingPrinters(query: string): Promise<ManufacturingPrinter[]> {
  const { data, error } = await supabase
    .rpc('search_manufacturing_printers', { search_query: query });

  if (error) throw error;

  return data || [];
}
