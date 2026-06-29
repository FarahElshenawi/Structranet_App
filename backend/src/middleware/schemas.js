/**
 * Zod schemas for request validation.
 */
import { z } from 'zod';

export const authSchemas = {
  register: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2).max(80),
  }),
  login: z.object({
    email: z.string().email('Invalid email format').min(1, 'Email is required'),
    password: z.string().min(1, 'Password is required'),
  }),
  refresh: z.object({
    refreshToken: z.string().min(1),
  }),
  logout: z.object({
    refreshToken: z.string().optional(),
  }),
};

export const profileSchemas = {
  update: z.object({
    gns3Server: z.object({
      host: z.string().nullable().optional(),
      port: z.number().int().min(1).max(65535).nullable().optional(),
    }).optional(),
    imageMap: z.record(z.string(), z.string()).optional(),
  }),
  testConnection: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
  }),
};

export const sessionSchemas = {
  create: z.object({}),
  updateTitle: z.object({
    title: z.string().min(1).max(200),
  }),
};

export const messageSchemas = {
  create: z.object({
    content: z.string().min(1).max(5000),
  }),
};

export const exportSchemas = {
  create: z.object({
    securityProfile: z.enum(['none', 'basic', 'enterprise']).optional(),
  }),
};
