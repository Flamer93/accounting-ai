import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Client Firebase web config from host env (no VITE_/NEXT_PUBLIC_ prefixes). */
function firebaseDefine() {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY ?? '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.FIREBASE_APP_ID ?? '',
  }
  return {
    __FIREBASE_CONFIG__: JSON.stringify(config),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: firebaseDefine(),
  server: {
    watch: {
      ignored: ['**/release/**', '**/dist-electron/**', '**/dist/**'],
    },
  },
})
