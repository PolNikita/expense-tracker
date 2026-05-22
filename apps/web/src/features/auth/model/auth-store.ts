import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { registerTokenGetter } from '@/shared/api/http-client';
import type { User } from '@/entities/user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setSession: (payload: { user: User; accessToken: string }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: ({ user, accessToken }) => set({ user, accessToken }),
      clear: () => set({ user: null, accessToken: null }),
    }),
    {
      name: 'expense-tracker:auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// Регистрируем геттер токена в http-client (без циклической зависимости).
// Вызывается один раз при инициализации модуля.
registerTokenGetter(() => useAuthStore.getState().accessToken);
