/**
 * Utility to bypass PostgREST's default 1000-row limit (max_rows)
 * by fetching in sequential paged chunks.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  fetchChunk: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchChunk(from, to);

    if (error) {
      console.error('Error fetching paged rows from Supabase:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...data);

    // If we received fewer rows than pageSize, we have reached the end
    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}
