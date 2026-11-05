import { HTTPResult, type RequestContext } from "@antelopejs/interface-api";
import type { DataControllerCallback } from "@antelopejs/interface-data-api";
import type { Parameters } from "@antelopejs/interface-data-api/components";
import { GetModel } from "@antelopejs/interface-database-decorators";
import { QuoteModel } from "../sales/database";
import { readBody } from "../shared/body-defaults";
import { isObject, isText, type JsonValue } from "../shared/json";
import { ProjectModel } from "./database";

/** The start of every project code. */
const PREFIX = "CH-";

/** The width of the sequence number of a project code, zero-padded. */
const DIGITS = 4;

/**
 * The next free code, after the highest one already used: the code follows the
 * others, CH-0101 being the oldest seeded project. A new project left without
 * a code takes it, and a duplicate starts without the code of the project it
 * copies.
 */
export async function nextProjectCode(): Promise<string> {
  const projects = await GetModel(ProjectModel).getAll();
  const last = projects.reduce((highest, project) => {
    if (!project.code?.startsWith(PREFIX)) return highest;
    const sequence = Number(project.code.slice(PREFIX.length));
    return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);
  return `${PREFIX}${String(last + 1).padStart(DIGITS, "0")}`;
}

/** Whether a body value is missing: absent, null or a blank string. */
const blank = (value: JsonValue | undefined): boolean =>
  value === undefined ||
  value === null ||
  (isText(value) && value.trim() === "");

/**
 * The `new` route with the code filled in when the body leaves it empty. A
 * `new` guard only gets a parsed copy of the body, so the code is written
 * into the body, handed on parsed, before the route (permission check,
 * guards, validation) runs.
 */
export function withProjectCode(
  route: DataControllerCallback,
): DataControllerCallback {
  return {
    ...route,
    func: async function (
      this: unknown,
      ctx: RequestContext,
      params: Parameters.NewParameters,
      raw: Buffer | string,
      ...rest: unknown[]
    ) {
      const body = readBody(raw);
      if (!body || !blank(body.code)) {
        const untouched: unknown = route.func.call(
          this,
          ctx,
          params,
          raw,
          ...rest,
        );
        return untouched;
      }
      body.code = await nextProjectCode();
      const created: unknown = route.func.call(
        this,
        ctx,
        params,
        body,
        ...rest,
      );
      return created;
    },
  };
}

/**
 * The `get` route, without the code when the row is read for a duplicate
 * (`?action=duplicate`): the copy then takes the next code on creation
 * instead of offering the original's, which the code rule would refuse.
 */
export function withoutCodeOnDuplicate(
  route: DataControllerCallback,
): DataControllerCallback {
  return {
    ...route,
    func: async function (
      this: unknown,
      ctx: RequestContext,
      ...rest: [params?: unknown, ...args: unknown[]]
    ) {
      const row: unknown = await route.func.call(this, ctx, ...rest);
      if (ctx.url?.searchParams.get("action") !== "duplicate") return row;
      if (!isObject(row)) return row;
      return { ...row, code: undefined };
    },
  };
}

/**
 * The calendar day of a date, as a sortable number (20261019): a project may
 * start and end the same day, whatever hours the form and the seed store.
 */
const dayOf = (value: Date | string | null | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (isText(value)) {
    if (value.trim() === "") return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value))
      return Number(value.replace(/-/g, ""));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return (
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  );
};

/**
 * Refuses (400) a code another project already carries, whatever form writes
 * it: the projects table's drawer, the detail page's form or a duplicate.
 */
export async function assertUniqueCode(
  code: string | null | undefined,
  ownId?: string,
): Promise<void> {
  if (!isText(code) || code.trim() === "") return;
  const taken = await GetModel(ProjectModel).getBy("code", code.trim());
  if (taken.some((project) => project._id !== ownId)) {
    throw new HTTPResult(400, {
      message: "$helio.projects.rules.codeTaken",
      field: "code",
    });
  }
}

/** Refuses (400) an end before the start. */
export function assertEndAfterStart(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): void {
  const from = dayOf(start);
  const to = dayOf(end);
  if (from !== undefined && to !== undefined && to < from) {
    throw new HTTPResult(400, {
      message: "$helio.projects.rules.endBeforeStart",
      field: "plannedEnd",
    });
  }
}

/**
 * Refuses (400) a quote made out to another customer than the project's. The
 * form's quote picker lists the chosen customer's quotes only, but a write that
 * does not come from it must hold too.
 */
export async function assertQuoteOfCustomer(
  customer: string | null | undefined,
  quote: string | null | undefined,
): Promise<void> {
  if (blank(customer) || blank(quote) || !isText(quote)) return;
  const row = await GetModel(QuoteModel).get(quote);
  if (row && row.customer !== customer) {
    throw new HTTPResult(400, {
      message: "$helio.projects.rules.quoteOfOtherCustomer",
      field: "quote",
    });
  }
}
