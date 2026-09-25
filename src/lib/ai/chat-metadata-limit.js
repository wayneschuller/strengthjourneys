/**
 * The most lifting-summary text the AI assistant sends with a message.
 *
 * The page trims its summary to fit (whole sections are dropped, never cut
 * mid-line) and every endpoint that receives it rejects anything longer, so
 * both sides read this one number. Six weeks of session lines plus records,
 * load, frequency and consistency fit comfortably. No imports on purpose, so
 * the page bundles nothing extra.
 */
export const MAX_CHAT_METADATA_CHARS = 10000;
