const FILTER_NUMBER_DECIMALS = 9;

export function formatFilterNumber(value: number): string {
  return value.toFixed(FILTER_NUMBER_DECIMALS).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
