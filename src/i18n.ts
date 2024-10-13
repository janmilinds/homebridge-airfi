import i18n from 'i18next';
import i18nextFsBackend, { FsBackendOptions } from 'i18next-fs-backend';
import path from 'path';

i18n.use(i18nextFsBackend).init<FsBackendOptions>({
  backend: {
    loadPath: path.join(__dirname, '/i18n/{{lng}}.json'),
  },
  fallbackLng: 'en',
  lng: 'en',
  supportedLngs: ['en', 'fi', 'sv'],
});

export default i18n;
