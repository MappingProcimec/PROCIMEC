// Ensure WebSocket is defined in testing environments for @supabase/realtime-js
if (typeof globalThis.WebSocket === 'undefined') {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;

    readyState = 1; // OPEN
    onopen: ((event: unknown) => void) | null = null;
    onclose: ((event: unknown) => void) | null = null;
    onmessage: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;

    constructor(_url?: string | URL, _protocols?: string | string[]) {}
    send(_data: unknown) {}
    close(_code?: number, _reason?: string) {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  }

  (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
}
