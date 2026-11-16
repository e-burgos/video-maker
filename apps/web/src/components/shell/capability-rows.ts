export type CapabilityRow = {
  name: string;
  enabled: boolean;
};

export function capabilityRows(capabilities: object, prefix = ''): CapabilityRow[] {
  return Object.entries(capabilities).flatMap(([key, value]): CapabilityRow[] => {
    const name = `${prefix}${key}`;
    if (typeof value === 'boolean') {
      return [{ name, enabled: value }];
    }
    if (typeof value === 'object' && value !== null) {
      return capabilityRows(value, `${name}.`);
    }
    return [];
  });
}
