import type { Class } from "@antelopejs/interface-core/decorators";
import type { InstanceId } from "@antelopejs/interface-database";
import type { PlainData } from "@antelopejs/interface-database-decorators/common";
import type { StoredRow } from "@antelopejs/interface-database-decorators/modifiers/common";
import {
  type DataModel,
  GetModel,
  triggerEvent,
} from "@antelopejs/interface-database-decorators";

const MS_PER_DAY = 86_400_000;

/** The date `days` away from `from`; negative is in the past. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

/** The date `months` calendar months after `from`, same day and time. */
export function addMonths(from: Date, months: number): Date {
  const date = new Date(from.getTime());
  date.setMonth(date.getMonth() + months);
  return date;
}

interface Runnable {
  run(): PromiseLike<string[]>;
}

/** The part of a model's table the seed uses: read a row, write a row. */
interface SeedTableHandle<T> {
  get(id: string): PromiseLike<object | null | undefined>;
  insert(row: StoredRow<T>): Runnable;
}

interface ModelInstance<T> {
  readonly table: SeedTableHandle<T>;
}

/** A table model whose statics convert rows, as every `BasicDataModel` has. */
export type SeedTable<T> = DataModel<T> &
  Class<ModelInstance<T>> & {
    toDatabase(row: PlainData<T> | T): StoredRow<T>;
  };

/**
 * A row to write: its id, and the fields the seed sets, in the plain form
 * `fromPlainData` reads: the model's own fields, a localized one given as its
 * text per locale.
 */
export type SeedRow<T> = { _id: string } & PlainData<T>;

/** The table class a model stores. */
export type RowOf<Model extends DataModel> =
  Model extends DataModel<infer T> ? T : never;

/** Turns a fresh instance into what gets stored, before it is converted. */
export type PrepareInstance<T> = (instance: T) => T;

function keepInstance<T>(instance: T): T {
  return instance;
}

function readDates(row: { _id: string }): [string, Date][] {
  return Object.entries<unknown>(row).filter(
    (entry): entry is [string, Date] => entry[1] instanceof Date,
  );
}

/**
 * Builds the stored form of a row the way the model's own `insert` does, so
 * hashing and revision modifiers run, then puts back the dates the seed
 * chose: the creation and update stamps would otherwise all read "now".
 */
function toStoredRow<T extends object>(
  model: SeedTable<T>,
  row: SeedRow<T>,
  prepare: PrepareInstance<T>,
): StoredRow<T> {
  const instance = prepare(model.fromPlainData(row));
  triggerEvent(instance, "insert");
  for (const [field, date] of readDates(row)) {
    Reflect.set(instance, field, date);
  }
  return model.toDatabase(instance);
}

/**
 * Writes the rows whose id is not stored yet and leaves the others alone, so
 * every boot (and every hot reload) can run the seed again safely. dms-saas
 * offers no API to create a workspace, a subscription or an invoice without
 * Stripe, so the seed writes rows the way dms-saas itself stores them, as its
 * own playground does.
 *
 * @param model Table model to write through
 * @param rows Rows to write, each with its `_id`
 * @param instanceId Tenant of a tenant-scoped table
 * @param prepare Last touch on each instance, e.g. writing every locale
 * @returns How many rows were written
 */
export async function insertMissing<T extends object>(
  model: SeedTable<T>,
  rows: SeedRow<T>[],
  instanceId?: InstanceId,
  prepare: PrepareInstance<T> = keepInstance,
): Promise<number> {
  const { table } = GetModel(model, instanceId);
  let written = 0;
  for (const row of rows) {
    if (await table.get(row._id)) continue;
    await table.insert(toStoredRow(model, row, prepare)).run();
    written++;
  }
  return written;
}
