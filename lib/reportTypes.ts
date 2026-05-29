export type ReportRow = Record<string, string | number | null | undefined>;

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "text";
  options?: string[];
}

export interface FieldConfig {
  key: string;
  label: string;
  defaultOn?: boolean;
  format?: (val: unknown, row: ReportRow) => string;
}

export interface ReportConfig {
  id: string;
  title: string;
  icon: string;
  description: string;
  category: string;
  filters: FilterConfig[];
  fields: FieldConfig[];
  fetchData: (dateFrom: string, dateTo: string, filters: Record<string, string>) => Promise<ReportRow[]>;
  summaryRow?: (rows: ReportRow[]) => ReportRow | null;
}
