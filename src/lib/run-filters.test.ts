import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRunQueryString,
  createPagination,
  normalizeRunListFilters,
} from "./run-filters";

test("normalizeRunListFilters applies defaults", () => {
  const filters = normalizeRunListFilters({});

  assert.deepEqual(filters, {
    status: "all",
    query: "",
    workflow: "all",
    environment: "all",
    from: "",
    to: "",
    page: 1,
    pageSize: 10,
  });
});

test("normalizeRunListFilters parses incoming query params", () => {
  const filters = normalizeRunListFilters({
    status: "failed",
    query: "finance",
    workflow: "Finance ops",
    environment: "production",
    from: "2026-05-01",
    to: "2026-05-13",
    page: "3",
    pageSize: "20",
  });

  assert.equal(filters.status, "failed");
  assert.equal(filters.query, "finance");
  assert.equal(filters.workflow, "Finance ops");
  assert.equal(filters.environment, "production");
  assert.equal(filters.from, "2026-05-01");
  assert.equal(filters.to, "2026-05-13");
  assert.equal(filters.page, 3);
  assert.equal(filters.pageSize, 20);
});

test("normalizeRunListFilters falls back on invalid numeric filters", () => {
  const filters = normalizeRunListFilters({
    page: "-4",
    pageSize: "2",
    status: "not-a-status",
  });

  assert.equal(filters.page, 1);
  assert.equal(filters.pageSize, 10);
  assert.equal(filters.status, "all");
});

test("createPagination clamps page to the available range", () => {
  const pagination = createPagination(11, 5, 5);

  assert.deepEqual(pagination, {
    page: 3,
    pageSize: 5,
    total: 11,
    pageCount: 3,
    hasPreviousPage: true,
    hasNextPage: false,
  });
});

test("buildRunQueryString omits default values", () => {
  const queryString = buildRunQueryString({
    status: "all",
    query: "",
    workflow: "all",
    environment: "all",
    from: "",
    to: "",
    page: 1,
    pageSize: 10,
  });

  assert.equal(queryString, "");
});

test("buildRunQueryString includes non-default values", () => {
  const queryString = buildRunQueryString(
    {
      status: "failed",
      query: "erp",
      workflow: "Finance ops",
      environment: "production",
      from: "",
      to: "",
      page: 2,
      pageSize: 20,
    },
    {
      page: 3,
    },
  );

  assert.equal(
    queryString,
    "?status=failed&query=erp&workflow=Finance+ops&environment=production&page=3&pageSize=20",
  );
});
