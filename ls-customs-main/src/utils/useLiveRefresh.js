// Hook that re-runs a function on a timer (used for live dashboard and notification refresh).
import { useEffect } from 'react';

// Calls `fn` every `ms` milliseconds while the tab is visible, and right away
// when the user comes back to the tab. Used so new bookings and status changes
// show up without a manual reload. Pass enabled=false to switch it off.
export function useLiveRefresh(enabled, fn, ms) {
  useEffect(function () {
    if (!enabled) return undefined;
    var timer = setInterval(function () {
      if (document.visibilityState === 'visible') fn();
    }, ms || 15000);
    function onVisible() { if (document.visibilityState === 'visible') fn(); }
    document.addEventListener('visibilitychange', onVisible);
    return function () {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, fn, ms]);
}
