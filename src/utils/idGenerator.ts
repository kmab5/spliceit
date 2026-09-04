let idCounter = 0;

/**
 * Generates a collision-resistant unique identifier.
 * Incorporates prefix, high-precision timestamp, incrementing counter, and crypto/pseudo-random string.
 */
export function generateUniqueId(prefix = 'clip'): string {
  idCounter = (idCounter + 1) % 1000000;
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${idCounter}-${rand}`;
}
