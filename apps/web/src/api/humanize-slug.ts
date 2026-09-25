export function humanizeSlug(slug: string): string {
  const words = slug.split('-').filter((word) => word.length > 0);
  if (words.length === 0) {
    return slug;
  }

  const joined = words.join(' ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}
