/** @format */

import Link from "next/link";
import { motion } from "motion/react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ChevronRight } from "lucide-react";

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 18,
};

// Map tool hrefs into named groups
const groupDefinitions = [
  {
    value: "calculators",
    label: "Calculators",
    hrefs: [
      "/calculator",
      "/warm-up-sets-calculator",
      "/strength-level-calculator",
      "/1000lb-club-calculator",
    ],
  },
  {
    value: "analysis",
    label: "Analysis & AI",
    hrefs: [
      "/analyzer",
      "/barbell-strength-potential",
      "/tonnage",
      "/ai-lifting-assistant",
      "/visualizer",
    ],
  },
  {
    value: "community",
    label: "Community",
    hrefs: [
      "/timer",
      "/gym-playlist-leaderboard",
      "/articles",
      "/strength-year-in-review",
    ],
  },
];

/**
 * Tabbed tool groups section replacing the flat card grid.
 * Receives the full featurePages array and buckets them by group.
 *
 * @param {Object} props
 * @param {Array<{href: string, title: string, description: string, IconComponent: React.ComponentType}>} props.tools
 */
export function ToolGroupsSection({ tools }) {
  // Index tools by href for fast lookup
  const toolMap = {};
  tools.forEach((t) => {
    toolMap[t.href] = t;
  });

  return (
    <section className="py-16 md:py-24">
      <motion.h2
        className="mb-8 text-center text-2xl font-bold tracking-tight md:text-3xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={springTransition}
      >
        A complete strength toolkit — free, forever.
      </motion.h2>

      <div className="mx-auto max-w-3xl">
        <Tabs defaultValue="calculators" className="w-full">
          <TabsList className="mb-6 flex w-full justify-center">
            {groupDefinitions.map((group) => (
              <TabsTrigger key={group.value} value={group.value}>
                {group.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {groupDefinitions.map((group) => (
            <TabsContent key={group.value} value={group.value}>
              <motion.div
                className="divide-y divide-border rounded-lg border"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springTransition}
              >
                {group.hrefs
                  .map((href) => toolMap[href])
                  .filter(Boolean)
                  .map((tool) => (
                    <ToolRow key={tool.href} tool={tool} />
                  ))}
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}

function ToolRow({ tool }) {
  const { href, title, description, IconComponent } = tool;
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
    >
      {IconComponent && (
        <IconComponent
          size={20}
          strokeWidth={1.5}
          className="shrink-0 text-muted-foreground transition-colors group-hover:text-amber-500"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight
        size={16}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}
