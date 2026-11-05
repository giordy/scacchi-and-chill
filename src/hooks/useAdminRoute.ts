import { useEffect, useState } from 'react';
import { isAdminLocation } from '../lib/routes';

// Admin mode is selected by the URL: #admin or ?admin
const check = () => isAdminLocation(window.location.hash, window.location.search);

export function useAdminRoute(): boolean {
  const [isAdminRoute, setIsAdminRoute] = useState(check);
  useEffect(() => {
    const onHash = () => setIsAdminRoute(check());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return isAdminRoute;
}
