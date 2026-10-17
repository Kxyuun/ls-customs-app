import { serviceDetails } from '../data/serviceData.js';

// Only these internal routes may be used as a post-login redirect. Anything
// else (external URLs, //host, javascript:, unknown paths) falls back to '/'.
var ALLOWED_PATHS = ['/book', '/account'];

// Accepts '/book', '/book?service=auto-care', and the legacy 'book.html' style.
export function safeRedirect(value) {
  if (typeof value !== 'string' || !value) return '/';
  var v = value.trim();
  if (/^book\.html$/i.test(v)) v = '/book';
  else if (/^account\.html$/i.test(v)) v = '/account';
  if (v.charAt(0) !== '/' || v.charAt(1) === '/' || v.indexOf('\\') !== -1) return '/';

  var url;
  try {
    url = new URL(v, 'http://internal.invalid');
  } catch (e) {
    return '/';
  }
  if (url.origin !== 'http://internal.invalid') return '/';

  // Normalize before comparing: lowercase, and drop a single trailing slash
  // ('/book/' and '/BOOK' both mean '/book').
  var path = url.pathname.toLowerCase();
  if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
  if (ALLOWED_PATHS.indexOf(path) === -1) return '/';

  if (path === '/book') {
    var svc = url.searchParams.get('service');
    if (svc && Object.prototype.hasOwnProperty.call(serviceDetails, svc)) {
      return '/book?service=' + encodeURIComponent(svc);
    }
  }
  return path;
}

export function loginUrlFor(pathWithSearch) {
  var safe = safeRedirect(pathWithSearch);
  return safe === '/' ? '/login' : '/login?redirect=' + encodeURIComponent(safe);
}
