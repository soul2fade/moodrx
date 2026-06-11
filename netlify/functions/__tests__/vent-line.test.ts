import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory Blobs stub
const blobStore = new Map<string, string>();
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: async (k: string) => blobStore.get(k) ?? null,
    set: async (k: string, v: string) => void blobStore.set(k, v),
  }),
}));

// Anthropic stub — returns one forced tool_use block we control per test
const createMock = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock };
  },
}));

const TOOL_OK = (over: Record<string, unknown> = {}) => ({
  content: [
    {
      type: 'tool_use',
      name: 'record_assessment',
      input: { mood: 'stressed', intensity: 7, reply: 'You showed up.', risk: 'none', ...over },
    },
  ],
});

async function call(body: unknown) {
  const { handler } = await import('../vent-line');
  return handler(
    { httpMethod: 'POST', body: body == null ? null : JSON.stringify(body) } as any,
    {} as any,
    () => {},
  ) as Promise<{ statusCode: number; body: string }>;
}

beforeEach(() => {
  blobStore.clear();
  createMock.mockReset();
  process.env.MOODRX_COACH_KEY = 'test-key';
});

describe('vent-line handler', () => {
  it('400 on empty body', async () => {
    const res = await call(null);
    expect(res.statusCode).toBe(400);
  });

  it('400 on missing transcript', async () => {
    const res = await call({ deviceId: 'd1' });
    expect(res.statusCode).toBe(400);
  });

  it('200 with resolved assessment on success', async () => {
    createMock.mockResolvedValue(TOOL_OK());
    const res = await call({ transcript: 'work is a lot right now', deviceId: 'd1' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ mood: 'stressed', intensity: 7, reply: 'You showed up.', risk: 'none' });
  });

  it('keyword backstop raises none->elevated when model under-flags', async () => {
    createMock.mockResolvedValue(TOOL_OK({ risk: 'none' }));
    const res = await call({ transcript: 'honestly I want to kill myself', deviceId: 'd1' });
    expect(JSON.parse(res.body).risk).toBe('elevated');
  });

  it('429 once the per-device daily cap is hit (no model call)', async () => {
    createMock.mockResolvedValue(TOOL_OK());
    for (let i = 0; i < 20; i++) await call({ transcript: 'x', deviceId: 'd1' });
    createMock.mockClear();
    const res = await call({ transcript: 'x', deviceId: 'd1' });
    expect(res.statusCode).toBe(429);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('502 when the model output fails validation', async () => {
    createMock.mockResolvedValue(TOOL_OK({ mood: 'sad' }));
    const res = await call({ transcript: 'x', deviceId: 'd1' });
    expect(res.statusCode).toBe(502);
  });
});
