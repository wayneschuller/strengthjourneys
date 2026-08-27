// How many entries go into the structured data. The whole board is small enough to include,
// but cap it so a future thousand-playlist page doesn't ship a megabyte of JSON-LD.
const MAX_JSONLD_ITEMS = 30;

/**
 * Builds ItemList structured data for the leaderboard — a ranked list of MusicPlaylist items,
 * which is the shape Google gives list treatment to.
 * @param {Object} params
 * @param {Array} params.playlists - Playlists in their current sort order.
 * @param {string} params.canonicalURL - Canonical page URL.
 * @returns {Object} JSON-LD object ready to stringify.
 */
export function buildLeaderboardJsonLd({ playlists, canonicalURL, title, description }) {
  const items = (playlists || []).slice(0, MAX_JSONLD_ITEMS).map((playlist, index) => {
    const totalVotes = (playlist.upVotes || 0) + (playlist.downVotes || 0);

    const musicPlaylist = {
      "@type": "MusicPlaylist",
      name: playlist.title,
      url: playlist.url,
      ...(playlist.description && { description: playlist.description }),
      ...(playlist.thumbnailUrl && { image: playlist.thumbnailUrl }),
      ...(playlist.categories?.length && { genre: playlist.categories }),
      // Only claim a rating where there is something to base it on, and derive it honestly
      // from the actual up/down split rather than stamping 5 stars on anything positive.
      ...(totalVotes > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Number(
            (1 + 4 * ((playlist.upVotes || 0) / totalVotes)).toFixed(2),
          ),
          bestRating: 5,
          worstRating: 1,
          ratingCount: totalVotes,
        },
      }),
    };

    return {
      "@type": "ListItem",
      position: index + 1,
      item: musicPlaylist,
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url: canonicalURL,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: items,
  };
}
