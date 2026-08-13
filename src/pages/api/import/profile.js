/*
 * Returns the authenticated user's lightweight recurring-import profile.
 * This enables cross-device convenience without exposing or storing lift data.
 */

import { getServerSession } from "next-auth/next";

import { getImportProfile } from "@/lib/import/import-profile-store";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const importProfile = await getImportProfile(session.user.email);
    return res.status(200).json({ importProfile });
  } catch (error) {
    console.error("[import-profile] read failed:", error);
    return res.status(500).json({ error: "Could not load import preferences" });
  }
}
