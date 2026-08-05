/**
 * A record as it comes out of storage, before migration.
 *
 * Only `version` can be counted on, and even that is optional: everything else
 * about the shape belongs to whichever release wrote the record, which is the
 * whole reason it is being migrated. A step that wants to read any other field
 * has to prove it is there first — `'aux' in data` narrows and yields
 * `unknown`, which is exactly as much as a step actually knows.
 *
 * Every current record type (`IOhMyMock`, `IState`, `IData`, `IMock`) is
 * assignable to this, so `MigrateUtils.migrate` can hand one straight to a step.
 */
export interface IOhMyStoredRecord {
  version?: string;
}

/**
 * One migration step.
 *
 * It mutates the record it is handed and returns that same object, or returns
 * `null` to say the record is too old to keep. Returning the very object it was
 * given is what lets `MigrateUtils.migrate` hand its caller back the type that
 * went in.
 */
export type IOhMyMigrationStep = (data: IOhMyStoredRecord) => IOhMyStoredRecord | null;

/**
 * The version a record was written with, read defensively: a record old enough
 * to need migrating may predate the field.
 */
export function recordVersion(data: IOhMyStoredRecord): string {
  return data.version || '0.0.0';
}

/**
 * Whether a field a step dug out of a record is an object it can index into.
 * `typeof null` is `'object'`, hence the second half.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Records older than this cannot be migrated and are discarded.
 *
 * One constant rather than the same literal in four step files, where the
 * comment beside each of them still said `3.0.3` — the number it had been two
 * raises earlier (3.0.0 -> 3.0.3 -> 3.2.0 -> 3.3.1). A reader checking whether
 * their profile survives an upgrade was told the wrong answer in every one of
 * them.
 */
export const OLDEST_MIGRATABLE = '3.3.1';
