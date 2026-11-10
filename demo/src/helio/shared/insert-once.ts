/** A table, or a model, that reads one row by its id. */
interface RowReader {
  get(id: string): PromiseLike<object | null | undefined>;
}

/**
 * Runs `insert`, which writes the row keyed by `id` into `table`, and tolerates
 * losing the race to another replica that wrote that row first: when the insert
 * fails and the row is stored, it answers `false`; when the row is still
 * missing, it rethrows the insert's error.
 *
 * @param table Table or model the row is read back from
 * @param id Id of the row `insert` writes
 * @param insert Writes the row
 * @returns Whether this call wrote the row
 */
export async function insertOnce(
  table: RowReader,
  id: string,
  insert: () => PromiseLike<object>,
): Promise<boolean> {
  try {
    await insert();
    return true;
  } catch (error) {
    if (await table.get(id)) return false;
    throw error;
  }
}
