import { useEffect, useState } from 'react';
import { getShopNow } from './dates.js';

// Current shop-local date/time, refreshed every 30s so "today", the past-slot
// cut-off and midnight roll-over stay correct while the page is open.
export function useShopNow() {
  var [now, setNow] = useState(function () { return getShopNow(); });

  useEffect(function () {
    var id = setInterval(function () {
      var next = getShopNow();
      setNow(function (prev) {
        return prev.dateStr === next.dateStr && prev.hour === next.hour && prev.minute === next.minute ? prev : next;
      });
    }, 30000);
    return function () { clearInterval(id); };
  }, []);

  return now;
}
