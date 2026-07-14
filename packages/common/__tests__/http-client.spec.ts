import axios from 'axios';
import { HttpClient } from '@ever-jobs/common';

jest.mock('axios');

describe('HttpClient 429 Retry-After handling', () => {
  let requestMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    requestMock = jest.fn();
    (axios.create as jest.Mock).mockReturnValue({ request: requestMock });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function makeRequest(client: HttpClient) {
    const promise = client.request({ url: 'https://example.com/jobs' });
    // Let the pending catch handlers register before advancing timers.
    promise.catch(() => {});
    return promise;
  }

  it('honors a numeric Retry-After header on 429 instead of the default backoff', async () => {
    const client = new HttpClient({ retries: 1, retryDelay: 1000, retryMaxDelay: 30000 });
    requestMock
      .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '5' } } })
      .mockResolvedValueOnce({ data: 'ok' });

    const promise = makeRequest(client);
    await Promise.resolve();

    // The default linear backoff for attempt 0 would be 1000ms; Retry-After says 5s.
    await jest.advanceTimersByTimeAsync(4999);
    expect(requestMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result).toEqual({ data: 'ok' });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('caps a Retry-After value at retryMaxDelay', async () => {
    const client = new HttpClient({ retries: 1, retryDelay: 1000, retryMaxDelay: 2000 });
    requestMock
      .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '60' } } })
      .mockResolvedValueOnce({ data: 'ok' });

    const promise = makeRequest(client);
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(1999);
    expect(requestMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result).toEqual({ data: 'ok' });
  });

  it('falls back to computed backoff when Retry-After is absent', async () => {
    const client = new HttpClient({ retries: 1, retryDelay: 1000, retryMaxDelay: 30000 });
    requestMock
      .mockRejectedValueOnce({ response: { status: 429, headers: {} } })
      .mockResolvedValueOnce({ data: 'ok' });

    const promise = makeRequest(client);
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(999);
    expect(requestMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result).toEqual({ data: 'ok' });
  });

  it('honors an HTTP-date Retry-After value', async () => {
    const client = new HttpClient({ retries: 1, retryDelay: 1000, retryMaxDelay: 30000 });
    const retryAt = new Date(Date.now() + 5000).toUTCString();
    requestMock
      .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': retryAt } } })
      .mockResolvedValueOnce({ data: 'ok' });

    const promise = makeRequest(client);
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(4000);
    expect(requestMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1500);
    const result = await promise;
    expect(result).toEqual({ data: 'ok' });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to computed backoff when Retry-After is unparseable', async () => {
    const client = new HttpClient({ retries: 1, retryDelay: 1000, retryMaxDelay: 30000 });
    requestMock
      .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': 'not-a-valid-value' } } })
      .mockResolvedValueOnce({ data: 'ok' });

    const promise = makeRequest(client);
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(999);
    expect(requestMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result).toEqual({ data: 'ok' });
  });

  it('ignores Retry-After on non-429 statuses and uses computed backoff', async () => {
    const client = new HttpClient({ retries: 1, retryDelay: 1000, retryMaxDelay: 30000 });
    requestMock
      .mockRejectedValueOnce({ response: { status: 503, headers: { 'retry-after': '5' } } })
      .mockResolvedValueOnce({ data: 'ok' });

    const promise = makeRequest(client);
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(999);
    expect(requestMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result).toEqual({ data: 'ok' });
  });
});
