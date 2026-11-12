import { z } from "zod";


export const connectionInput = z.object({
  clientId: z.string().trim().min(20).max(200).regex(/^[A-Za-z0-9_-]+$/),
  clientSecret: z.string().trim().min(20).max(300).regex(/^[A-Za-z0-9_-]+$/),
  password: z.string().min(1).max(200),
});

export const passwordOnly = z.object({ password: z.string().min(1).max(200) });


export function maskClientId(id: string): string {
  if (id.length <= 10) return "****";
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}