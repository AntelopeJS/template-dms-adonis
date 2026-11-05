/**
 * Name of the schema owned by this template. Every table the template defines itself is
 * registered under it via `@RegisterTable(_, DEMO_SCHEMA_NAME)` and provisioned by
 * `RegisterSchema(DEMO_SCHEMA_NAME)` in the `DATABASE_INITIALIZED` hook of `construct()`
 * (see src/index.ts), instead of piggybacking on the DMS core schema.
 */
export const DEMO_SCHEMA_NAME = "template-dms-demo";
