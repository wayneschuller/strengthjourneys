import { kv } from "@vercel/kv";
import { devLog } from "@/lib/processing-utils";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const playlists = await kv.lrange("playlists", 0, -1);
      res.status(200).json(playlists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      res.status(500).json({ error: "Error fetching playlists" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
