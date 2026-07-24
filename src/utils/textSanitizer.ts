/**
 * Helper utility to sanitize text for PDF generation and clean UI rendering.
 * Strips emojis, non-standard unicode characters, and garbled symbols.
 */

export const sanitizeForPDF = (text: string | null | undefined, maxLen: number = 0): string => {
  if (!text) return '-';

  let clean = text
    // Strip emojis and high-range Unicode symbols
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu, '')
    // Remove characters outside standard printable ASCII and Latin-1 supplement (for Spanish accents á, é, í, ó, ú, ñ, Ñ, etc.)
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    // Collapse internal newlines and multiple spaces into a single space
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return '-';

  if (maxLen > 0 && clean.length > maxLen) {
    return clean.substring(0, maxLen - 3) + '...';
  }
  return clean;
};

export const truncateText = (text: string | null | undefined, maxLength: number = 120): string => {
  if (!text) return '-';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.substring(0, maxLength - 3) + '...';
};
