import { z } from "zod";
import { environmentValues, runStatusValues } from "./validators";

const pageSizeOptions = [5, 10, 20, 50] as const;
const statusValues = ["all", ...runStatusValues] as const;
const environmentFilterValues = ["all", ...environmentValues] as const;

export type RunListFilters = {
  status: (typeof statusValues)[number];
  query: string;
  workflow: string;
  environment: (typeof environmentFilterValues)[number];
  from: string;
  to: string;
  page: number;
  pageSize: (typeof pageSizeOptions)[number];
};

export type RunPagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type FilterInput = URLSearchParams | Record<string, string | string[] | undefined>;

function getInputValue(
  input: FilterInput,
  key: keyof RunListFilters,
): string | undefined {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }

  const value = input[key];

  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value: string | undefined): (typeof pageSizeOptions)[number] {
  const parsed = Number.parseInt(value ?? "", 10);

  return pageSizeOptions.includes(parsed as (typeof pageSizeOptions)[number])
    ? (parsed as (typeof pageSizeOptions)[number])
    : 10;
}

export function normalizeRunListFilters(input: FilterInput): RunListFilters {
  const status = getInputValue(input, "status");
  const environment = getInputValue(input, "environment");

  return {
    status: z.enum(statusValues).catch("all").parse(status),
    query: getInputValue(input, "query")?.trim() ?? "",
    workflow: getInputValue(input, "workflow")?.trim() || "all",
    environment: z.enum(environmentFilterValues).catch("all").parse(environment),
    from: getInputValue(input, "from")?.trim() ?? "",
    to: getInputValue(input, "to")?.trim() ?? "",
    page: parsePage(getInputValue(input, "page")),
    pageSize: parsePageSize(getInputValue(input, "pageSize")),
  };
}

export function createPagination(total: number, page: number, pageSize: number): RunPagination {
  const pageCount = total === 0 ? 1 : Math.ceil(total / pageSize);
  const safePage = Math.min(page, pageCount);

  return {
    page: safePage,
    pageSize,
    total,
    pageCount,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < pageCount,
  };
}

export function buildRunQueryString(
  filters: RunListFilters,
  overrides?: Partial<RunListFilters>,
) {
  const nextFilters = {
    ...filters,
    ...overrides,
  };
  const params = new URLSearchParams();

  if (nextFilters.status !== "all") {
    params.set("status", nextFilters.status);
  }

  if (nextFilters.query.trim()) {
    params.set("query", nextFilters.query.trim());
  }

  if (nextFilters.workflow !== "all") {
    params.set("workflow", nextFilters.workflow);
  }

  if (nextFilters.environment !== "all") {
    params.set("environment", nextFilters.environment);
  }

  if (nextFilters.from) {
    params.set("from", nextFilters.from);
  }

  if (nextFilters.to) {
    params.set("to", nextFilters.to);
  }

  if (nextFilters.page > 1) {
    params.set("page", `${nextFilters.page}`);
  }

  if (nextFilters.pageSize !== 10) {
    params.set("pageSize", `${nextFilters.pageSize}`);
  }

  const queryString = params.toString();

  return queryString.length > 0 ? `?${queryString}` : "";
}

export const runPageSizeOptions = [...pageSizeOptions];
