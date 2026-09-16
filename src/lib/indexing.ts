/**
 * Utilidades de indexación de alto rendimiento para colecciones en memoria.
 * Convierte iteraciones repetitivas O(N * M) a consultas directas O(1).
 */

/**
 * Crea un Map indexado por una clave única o derivada.
 * Complejidad: O(N) en tiempo de construcción, O(1) en consultas.
 */
export function indexBy<T, K extends string | number>(
  items: T[] | undefined | null,
  keyFn: (item: T) => K | undefined | null
): Map<K, T> {
  const map = new Map<K, T>();
  if (!items) return map;

  for (let i = 0; i < items.length; i++) {
    const key = keyFn(items[i]);
    if (key !== undefined && key !== null) {
      map.set(key, items[i]);
    }
  }

  return map;
}

/**
 * Agrupa elementos en un Map según una clave.
 * Complejidad: O(N) en tiempo de construcción, O(1) en consultas.
 */
export function groupBy<T, K extends string | number>(
  items: T[] | undefined | null,
  keyFn: (item: T) => K | undefined | null
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  if (!items) return map;

  for (let i = 0; i < items.length; i++) {
    const key = keyFn(items[i]);
    if (key !== undefined && key !== null) {
      const existing = map.get(key);
      if (existing) {
        existing.push(items[i]);
      } else {
        map.set(key, [items[i]]);
      }
    }
  }

  return map;
}
