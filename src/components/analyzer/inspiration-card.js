"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";

const inspirationalQuotes = [
  {
    quote:
      "Strong people are harder to kill than weak people and more useful in general. A weak man is not as happy as that same man would be if he were strong.",
    author: "Mark Rippetoe, Starting Strength",
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
  {
    quote:
      "I have my own therapy. I will choose the iron to feel what most other people only feel when someone else tells them to. Those that use the iron as therapy and as an escape really get it, because the mind and body are one – working, thriving, and alive,",
    author: "Jim Steel",
    URL: null,
  },
  {
    quote:
      "Life in the weight room is like working on a building that is always under construction. Work is never complete, so learn to fall in love with the process.",
    author: "Dr. Aaron Horschig (Squat University)",
    URL: null,
  },
  {
    quote:
      "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.'",
    author: "Muhammad Ali",
    URL: null,
  },
  {
    quote: "Slowly is the fastest way to get to where you want to be.",
    author: "André De Shields",
    URL: null,
  },
  {
    quote:
      "The weight room is a place where the trials never end. It is the place where we test ourselves continuously - we struggle to reach one goal, and, as soon as we reach it, there is another and more difficult one to meet.",
    author: "Dave Tate, EliteFTS",
    URL: null,
  },
  {
    quote:
      "Your health will likely run out before your money. Invest proportionally.",
    author: "Source unknown.",
    URL: null,
  },
  {
    quote:
      "Ask yourself: What can I take away from today that was a win? Even if it was just turning up at the gym, going out on a walk, or doing one little thing that was positive.",
    author: "Craig Richey",
    URL: "https://youtu.be/HEqMMGon2zc?si=ddr2b32gdVD1JkGh&t=1393",
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
