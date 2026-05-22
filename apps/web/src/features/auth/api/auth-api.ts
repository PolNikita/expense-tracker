import type { AuthResponse, LoginInput, RegisterInput } from '@expense-tracker/types';
import { http } from '@/shared/api/http-client';
import { ENDPOINTS } from '@/shared/api/endpoints';

export const authApi = {
  login: (body: LoginInput) => http.post<AuthResponse>(ENDPOINTS.authLogin, body),
  register: (body: RegisterInput) =>
    http.post<AuthResponse>(ENDPOINTS.authRegister, body),
};
