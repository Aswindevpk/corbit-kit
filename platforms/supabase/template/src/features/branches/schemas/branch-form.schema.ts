import { z } from 'zod';

// UX validation only. The backend re-validates and returns coded errors whose
// `field` matches these keys (code, name).
export const branchFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'Use 2–20 letters, numbers or dashes.'),
  name: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters.')
    .max(120, 'Keep the name under 120 characters.'),
});

export type BranchFormValues = z.infer<typeof branchFormSchema>;
