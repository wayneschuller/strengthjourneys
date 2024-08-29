import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const { id, voteType, action } = req.query;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  if (!id || !voteType || !action) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    let field;
    let incrementValue = action === "increment" ? 1 : -1;

    if (voteType === "upVote") {
      field = "upVotes";
    } else if (voteType === "downVote") {
      field = "downVotes";
    } else {
      return res.status(400).json({ message: "Invalid voteType parameter" });
    }

    // Update the votes count in Redis
    const newVotes = await kv.hincrby(`playlists:${id}`, field, incrementValue);

    res.status(200).json({ id, [field]: newVotes });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
}
