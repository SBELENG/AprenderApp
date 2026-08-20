import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan las credenciales de Supabase en el archivo .env');
}

// Función auxiliar para esperar el estado inicial de autenticación de Firebase
const getFirebaseToken = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        try {
          const token = await user.getIdToken();
          resolve(token);
        } catch (e) {
          console.warn("Error al obtener token de Firebase:", e);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, options = {}) => {
      let token = null;
      // Si Firebase ya inicializó el usuario, lo tomamos directamente
      if (auth.currentUser) {
        try {
          token = await auth.currentUser.getIdToken();
        } catch (e) {
          console.warn("Error al refrescar token de Firebase:", e);
        }
      } else {
        // Si aún no se inicializó, esperamos a que lo haga
        token = await getFirebaseToken();
      }

      if (token) {
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${token}`);
        options.headers = headers;
      }
      
      // Llamar al fetch original
      return fetch(url, options);
    }
  }
});
