export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8000');
export const LOCAL_USER_ID = import.meta.env.VITE_LOCAL_USER_ID || 'local_owner';
export const IS_DESKTOP = import.meta.env.VITE_TRAQU_DESKTOP === 'true';

export const IS_MOBILE = import.meta.env.VITE_TRAQU_MOBILE === 'true';
export const IS_NATIVE = IS_DESKTOP || IS_MOBILE;
