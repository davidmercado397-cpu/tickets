import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { es } from './locales/es-CO';

/** i18n en es-CO. Namespaces por dominio; sin cambio de idioma en runtime (por ahora). */
export const i18nInstance = i18n.createInstance();

void i18nInstance.use(initReactI18next).init({
  lng: 'es-CO',
  fallbackLng: 'es-CO',
  ns: ['common', 'auth', 'tickets', 'admin', 'errors', 'nav', 'notifications', 'employees', 'sla'],
  defaultNS: 'common',
  resources: { 'es-CO': es },
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18nInstance;
