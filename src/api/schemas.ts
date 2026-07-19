import { z } from 'zod';

export const captureBodySchema = z
  .object({
    url: z.string().min(1),
    requester_key: z.string().min(1).max(512).optional(),
    wait: z.enum(['load', 'networkidle']).optional(),
  })
  .strict();

export const navigateBodySchema = z
  .object({
    url: z.string().min(1),
    click_selector: z.string().min(1).max(1024).optional(),
    follow_link_text: z.string().min(1).max(1024).optional(),
    requester_key: z.string().min(1).max(512).optional(),
    wait: z.enum(['load', 'networkidle']).optional(),
  })
  .strict()
  .refine((body) => (body.click_selector ? 1 : 0) + (body.follow_link_text ? 1 : 0) === 1, {
    message: 'provide exactly one of click_selector or follow_link_text',
  });

export type CaptureBody = z.infer<typeof captureBodySchema>;
export type NavigateBody = z.infer<typeof navigateBodySchema>;
