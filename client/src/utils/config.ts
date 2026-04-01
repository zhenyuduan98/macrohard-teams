const isProd = import.meta.env.PROD;

export const API_BASE = isProd ? '/api' : `http://${window.location.hostname}:3001/api`;
export const SOCKET_URL = isProd ? undefined : `http://${window.location.hostname}:3001`;
export const BACKEND_URL = isProd ? '' : `http://${window.location.hostname}:3001`;

export const imageUrl = (src: string): string =>
  src.startsWith('http') ? src : `${BACKEND_URL}${src}`;
