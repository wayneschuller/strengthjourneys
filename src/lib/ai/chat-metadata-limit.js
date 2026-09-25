/**
 * The most lifting-summary text the AI assistant sends with a message.
 *
 * The page trims its summary to fit (whole sections are dropped, never cut
 * mid-line) and every endpoint that receives it rejects anything longer, so
 * both sides read this one number. It fits the last 20 sessions set by set
 * plus per-lift records, trends, load and consistency, about 4,000 tokens.
 * No imports on purpose, so the page bundles nothing extra.
 */
export const MAX_CHAT_METADATA_CHARS = 16000;
