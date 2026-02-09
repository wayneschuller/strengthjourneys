"use client";

/**
 * Maps a strength rating label to a shadcn/ui Badge variant.
 * Keeps badge colors consistent across PR cards, session analysis, etc.
 */
export const getRatingBadgeVariant = (rating) => {
  switch (rating) {
    case "Elite":
    case "Advanced":
      return "default";
    case "Intermediate":
      return "secondary";
    case "Beginner":
    case "Physically Active":
    default:
      return "outline";
  }
};

