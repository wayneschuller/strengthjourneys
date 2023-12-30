"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";

const inspirationalQuotes = [
  {
    quote:
      "Strong people are harder to kill than weak people and more useful in general. A weak man is not as happy as that same man would be if he were strong.",
    author: "Mark Rippetoe",
    URL: null,
  },
  {
    quote: "The only bad workout is the one that didn't happen.",
    author: "Unknown",
    URL: null,
  },
  {
    quote:
      "In the military we always say we don’t rise to the level of our expectations, we fall to the level of our training",
    author: "David Goggins",
    URL: null,
  },
  {
    quote: "Whether you think you can, or you think you can’t, you’re right.",
    author: "Henry Ford",
    URL: null,
  },
  {
    quote:
      "For me, life is continuously being hungry. The meaning of life is not simply to exist, to survive, but to move ahead, to go up, to achieve, to conquer. ",
    author: "Arnold Schwarzenegger",
    URL: null,
  },
];

const getRandomQuote = () => {
  const randomIndex = Math.floor(Math.random() * inspirationalQuotes.length);
  return inspirationalQuotes[randomIndex];
};

export function InspirationCard({}) {
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const quote = getRandomQuote();
    setQuote(quote);
  }, []);

  if (!quote) return;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Inspirational Quote</CardTitle>
      </CardHeader>
      <CardContent className="grid flex-1 content-around">
        <div className="text-xl italic md:text-2xl">
          &ldquo;{quote.quote}&rdquo;
          <div className="mt-2 text-right text-lg md:text-xl">
            {quote.author}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
