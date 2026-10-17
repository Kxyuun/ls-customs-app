import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Route-change scroll handling:
//  - new page (PUSH/REPLACE): scroll to top
//  - "#section" links: scroll that section into view (no page reload)
//  - back/forward (POP): restore the position the user had on that entry
export default function ScrollManager() {
  var location = useLocation();
  var navType = useNavigationType();
  var positions = useRef({});
  var currentKey = useRef(location.key);

  useEffect(function () {
    var previous;
    try {
      previous = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
    } catch (e) { /* ignore */ }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        positions.current[currentKey.current] = window.scrollY;
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return function () {
      window.removeEventListener('scroll', onScroll);
      try { if (previous) window.history.scrollRestoration = previous; } catch (e) { /* ignore */ }
    };
  }, []);

  useLayoutEffect(function () {
    var saved = positions.current[location.key];
    currentKey.current = location.key;

    if (location.hash) {
      var id = location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch (e) { /* keep raw id */ }
      var el = document.getElementById(id);
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    if (navType === 'POP' && typeof saved === 'number') {
      window.scrollTo(0, saved);
      return;
    }
    window.scrollTo(0, 0);
  }, [location.key, location.hash, navType]);

  return null;
}
