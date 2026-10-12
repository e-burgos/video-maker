import type { RenderApiClient } from '../client/render-api-client';

export interface FakeRenderApiClientCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

export interface FakeRenderApiClient extends RenderApiClient {
  readonly calls: readonly FakeRenderApiClientCall[];
}

export function createFakeRenderApiClient(overrides: Partial<RenderApiClient> = {}): FakeRenderApiClient {
  const calls: FakeRenderApiClientCall[] = [];

  function record<Args extends readonly unknown[], Result>(
    method: string,
    args: Args,
    handler: ((...args: Args) => Promise<Result>) | undefined,
  ): Promise<Result> {
    calls.push({ method, args });
    if (handler === undefined) {
      throw new Error(`createFakeRenderApiClient: no ${method} override configured`);
    }
    return handler(...args);
  }

  return {
    calls,
    getProjectDetail: (...args) => record('getProjectDetail', args, overrides.getProjectDetail),
    listProjectAssets: (...args) => record('listProjectAssets', args, overrides.listProjectAssets),
    listPendingAssets: (...args) => record('listPendingAssets', args, overrides.listPendingAssets),
    listRecentJobs: (...args) => record('listRecentJobs', args, overrides.listRecentJobs),
    readProducerScriptState: (...args) => record('readProducerScriptState', args, overrides.readProducerScriptState),
    probeMedia: (...args) => record('probeMedia', args, overrides.probeMedia),
    extractFrames: (...args) => record('extractFrames', args, overrides.extractFrames),
    readFileBytes: (...args) => record('readFileBytes', args, overrides.readFileBytes),
    readProjectText: (...args) => record('readProjectText', args, overrides.readProjectText),
    writeProjectText: (...args) => record('writeProjectText', args, overrides.writeProjectText),
    copyAsset: (...args) => record('copyAsset', args, overrides.copyAsset),
    listVoices: (...args) => record('listVoices', args, overrides.listVoices),
    createJob: (...args) => record('createJob', args, overrides.createJob),
    getJob: (...args) => record('getJob', args, overrides.getJob),
    cancelJob: (...args) => record('cancelJob', args, overrides.cancelJob),
    getTimeline: (...args) => record('getTimeline', args, overrides.getTimeline),
    putTimeline: (...args) => record('putTimeline', args, overrides.putTimeline),
    searchFreeMusic: (...args) => record('searchFreeMusic', args, overrides.searchFreeMusic),
    importMusic: (...args) => record('importMusic', args, overrides.importMusic),
    searchFreeMedia: (...args) => record('searchFreeMedia', args, overrides.searchFreeMedia),
    importMedia: (...args) => record('importMedia', args, overrides.importMedia),
    previewImages: (...args) => record('previewImages', args, overrides.previewImages),
    getRenderReview: (...args) => record('getRenderReview', args, overrides.getRenderReview),
    listReferences: (...args) => record('listReferences', args, overrides.listReferences),
    getReference: (...args) => record('getReference', args, overrides.getReference),
    getProposalState: (...args) => record('getProposalState', args, overrides.getProposalState),
    putProposal: (...args) => record('putProposal', args, overrides.putProposal),
    getMaterialReview: (...args) => record('getMaterialReview', args, overrides.getMaterialReview),
    putMaterialReview: (...args) => record('putMaterialReview', args, overrides.putMaterialReview),
    listMotionBrands: (...args) => record('listMotionBrands', args, overrides.listMotionBrands),
    getMotionBrief: (...args) => record('getMotionBrief', args, overrides.getMotionBrief),
    putMotionBrief: (...args) => record('putMotionBrief', args, overrides.putMotionBrief),
    getMotionStoryboard: (...args) => record('getMotionStoryboard', args, overrides.getMotionStoryboard),
    putMotionStoryboard: (...args) => record('putMotionStoryboard', args, overrides.putMotionStoryboard),
  };
}
