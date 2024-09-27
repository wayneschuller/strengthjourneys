import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  const adminEmails = process.env
    .NEXT_PUBLIC_STRENGTH_JOURNEYS_LEADERBOARD_ADMINS
    ? process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_LEADERBOARD_ADMINS.split(",")
    : [];
  const isAdmin = adminEmails.includes(session?.user?.email);

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Check if the user is authenticated
  if (!isAdmin) {
    return res.status(403).json({ message: "Forbidden: User is not an admin" });
  }

  try {
    // Revalidate the fixed path
    const path = "/gym-playlist-leaderboard";
    await res.revalidate(path);

    return res.json({
      revalidated: true,
      message: `Path ${path} revalidated successfully`,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error revalidating", error: err.message });
  }
}
