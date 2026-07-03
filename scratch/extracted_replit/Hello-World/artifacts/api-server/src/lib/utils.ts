/**
 * Safely parses an Express route param (which can be string | string[] in Express 5)
 * to an integer. Always pass req.params.X through this before parseInt.
 */
export function parseParam(param: string | string[]): number {
  return parseInt(Array.isArray(param) ? param[0] : param, 10);
}

/**
 * Safely converts an Express route param to a plain string.
 */
export function stringParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}
