/**
 * Browser-only AlaSQL shim.
 * Turbopack resolveAlias remaps 'alasql' to the browser bundle.
 * Do NOT import this file during SSR — SqlView.tsx imports it lazily on the client only.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const alasql = require("alasql");
export default alasql as (query: string, params?: unknown[]) => unknown;
