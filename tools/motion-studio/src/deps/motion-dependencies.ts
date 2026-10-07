import type { MotionPipelinePorts } from '@video-maker/motion-graphics';

export type { RenderRequest } from '@video-maker/motion-graphics';

export interface MotionDependencies extends MotionPipelinePorts {
  templatesRoot: string;
}
