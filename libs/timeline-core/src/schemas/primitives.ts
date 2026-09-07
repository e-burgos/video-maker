import { z } from 'zod';

export const MsSchema = z.number().int().nonnegative();
export const FrameSchema = z.number().int().nonnegative();
export const DbSchema = z.number();
export const LufsSchema = z.number().max(0);
export const ScaleSchema = z.number().min(1).max(2);
export const IdSchema = z.string().min(1);
export const FpsSchema = z.literal([24, 25, 30, 50, 60]);
