/**
 * Módulo de Cola Offline (Outbox Pattern) para PWA
 * Proporciona resiliencia y retención de envíos de formularios en campo
 * cuando la conectividad celular o de red se interrumpe.
 */

export interface QueuedItem<T = unknown> {
  id: string;
  queueName: string;
  timestamp: number;
  retryCount: number;
  payload: T;
}

// Almacén en memoria como fallback para SSR o entornos sin localStorage disponible
const memoryStores: Record<string, QueuedItem[]> = {};

function getStorageKey(queueName: string): string {
  return `pcm_offline_queue_${queueName}`;
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Encola un elemento para envío diferido cuando retorne la conexión
 */
export function enqueueOfflineItem<T>(queueName: string, payload: T): QueuedItem<T> {
  const item: QueuedItem<T> = {
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    queueName,
    timestamp: Date.now(),
    retryCount: 0,
    payload,
  };

  const queue = getOfflineQueue<T>(queueName);
  queue.push(item);

  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(getStorageKey(queueName), JSON.stringify(queue));
    } catch (err) {
      console.warn(`[OfflineQueue] No se pudo escribir en localStorage:`, err);
    }
  } else {
    memoryStores[queueName] = queue as unknown as QueuedItem[];
  }

  return item;
}

/**
 * Obtiene todos los elementos pendientes en la cola especificada
 */
export function getOfflineQueue<T>(queueName: string): QueuedItem<T>[] {
  if (hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(getStorageKey(queueName));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueuedItem<T>[]) : [];
    } catch (err) {
      console.warn(`[OfflineQueue] Error al leer cola ${queueName}:`, err);
      return [];
    }
  }

  return (memoryStores[queueName] || []) as unknown as QueuedItem<T>[];
}

/**
 * Elimina un elemento de la cola por su identificador único
 */
export function dequeueOfflineItem(queueName: string, id: string): boolean {
  const queue = getOfflineQueue(queueName);
  const filtered = queue.filter((item) => item.id !== id);
  const found = filtered.length !== queue.length;

  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(getStorageKey(queueName), JSON.stringify(filtered));
    } catch (err) {
      console.warn(`[OfflineQueue] Error al persistir dequeue:`, err);
    }
  } else {
    memoryStores[queueName] = filtered;
  }

  return found;
}

/**
 * Limpia totalmente la cola de envíos offline
 */
export function clearOfflineQueue(queueName: string): void {
  if (hasLocalStorage()) {
    try {
      window.localStorage.removeItem(getStorageKey(queueName));
    } catch {
      // Ignorar fallo de storage
    }
  }
  delete memoryStores[queueName];
}

/**
 * Evalúa si el cliente tiene conexión activa a internet
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Procesa y sincroniza todos los elementos encolados con un despachador asíncrono
 */
export async function syncOfflineQueue<T>(
  queueName: string,
  handler: (payload: T) => Promise<boolean>
): Promise<{ successCount: number; failureCount: number }> {
  const queue = getOfflineQueue<T>(queueName);
  if (queue.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;

  for (const item of queue) {
    try {
      const ok = await handler(item.payload);
      if (ok) {
        dequeueOfflineItem(queueName, item.id);
        successCount++;
      } else {
        item.retryCount += 1;
        failureCount++;
      }
    } catch {
      item.retryCount += 1;
      failureCount++;
    }
  }

  return { successCount, failureCount };
}

/**
 * Registra un escucha que sincroniza automáticamente cuando se detecte reconexión
 */
export function registerOnlineSyncListener<T>(
  queueName: string,
  handler: (payload: T) => Promise<boolean>
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const sync = () => {
    if (isOnline()) {
      syncOfflineQueue(queueName, handler);
    }
  };

  window.addEventListener('online', sync);
  return () => {
    window.removeEventListener('online', sync);
  };
}
