// Thin fetch wrapper for future backend calls. Turns network failures and
// non-OK responses into a thrown ApiError so callers can't accidentally treat
// a 4xx/5xx as success.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest(url, options) {
  var opts = options || {};
  var headers = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;

  var res;
  try {
    res = await fetch(url, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) {
    throw new ApiError('Network error', 0);
  }

  if (!res.ok) throw new ApiError('Request failed', res.status);
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}
