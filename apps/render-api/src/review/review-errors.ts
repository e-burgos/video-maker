export class ReviewInputsUnavailableError extends Error {
  readonly resource: string;

  constructor(resource: string, reason: string) {
    super(`No se puede revisar el render: ${reason} (${resource}).`);
    this.name = 'ReviewInputsUnavailableError';
    this.resource = resource;
  }
}
