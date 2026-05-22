import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

export const RegisterSchema = z.object({
  name: z.string().min(1, 'Введите имя').max(120),
  email: z.string().email('Некорректный email').max(254),
  password: z
    .string()
    .min(8, 'Пароль должен содержать не менее 8 символов')
    .max(128),
});

export type LoginFormValues = z.infer<typeof LoginSchema>;
export type RegisterFormValues = z.infer<typeof RegisterSchema>;
