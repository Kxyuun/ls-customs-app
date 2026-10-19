// Hook that sets the browser tab title for a page.
import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(function () {
    document.title = title;
  }, [title]);
}
