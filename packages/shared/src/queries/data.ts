/*
  기대값

  - useDataStats()
    data: { total_records: number, active_sensors: number, data_size_mb: number, collection_rate: number }

  - useDataPreview()
    data: { data: Record<string, any> }
*/
import { useQuery } from "@tanstack/react-query";
import { dataAPI } from "../api/data";

export function useDataStats() {
  return useQuery({
    queryKey: ["data-stats"],
    queryFn: () => dataAPI.stats(),
    refetchInterval: 10_000,
  });
}

export function useDataPreview() {
  return useQuery({
    queryKey: ["data-preview"],
    queryFn: () => dataAPI.preview(),
    staleTime: 2_000,
  });
}


