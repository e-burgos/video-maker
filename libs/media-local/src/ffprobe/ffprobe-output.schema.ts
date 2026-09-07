import { z } from 'zod';

export const FfprobeStreamSchema = z.object({
  index: z.number().int(),
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  avg_frame_rate: z.string().optional(),
  r_frame_rate: z.string().optional(),
  duration: z.string().optional(),
  sample_rate: z.string().optional(),
  channels: z.number().int().optional(),
  nb_frames: z.string().optional(),
  disposition: z.record(z.string(), z.number()).optional(),
  tags: z.record(z.string(), z.string()).optional(),
  side_data_list: z.array(z.object({ rotation: z.number().optional() }).loose()).optional(),
});

export const FfprobeOutputSchema = z.object({
  streams: z.array(FfprobeStreamSchema).default([]),
  format: z
    .object({
      filename: z.string().optional(),
      format_name: z.string().optional(),
      duration: z.string().optional(),
      tags: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export type FfprobeStream = z.infer<typeof FfprobeStreamSchema>;
export type FfprobeOutput = z.infer<typeof FfprobeOutputSchema>;
