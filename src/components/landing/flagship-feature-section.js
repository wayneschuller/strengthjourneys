/** @format */

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 18,
};

/**
 * Reusable two-column section: screenshot on one side, marketing copy on the other.
 * Use the `reversed` prop to alternate image/text placement between sections.
 *
 * @param {Object} props
 * @param {string} props.title - Section heading
 * @param {React.ReactNode} props.description - Body copy (can include JSX for inline links)
 * @param {string} props.imageSrc - Path to the screenshot image
 * @param {string} props.imageAlt - Alt text for the image
 * @param {string} props.href - CTA link destination
 * @param {string} props.linkText - CTA button label
 * @param {boolean} [props.reversed=false] - Flip the layout (image right, text left)
 */
export function FlagshipFeatureSection({
  title,
  description,
  imageSrc,
  imageAlt = "Feature screenshot",
  href,
  linkText,
  reversed = false,
}) {
  return (
    <section className="py-16 md:py-24">
      <div
        className={`mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16 ${
          reversed ? "md:[direction:rtl]" : ""
        }`}
      >
        {/* Image side */}
        <motion.div
          className="md:[direction:ltr]"
          initial={{ opacity: 0, x: reversed ? 40 : -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={springTransition}
        >
          <div className="overflow-hidden rounded-2xl border border-muted-foreground/10 shadow-xl">
            <Image
              src={imageSrc}
              alt={imageAlt}
              width={800}
              height={500}
              className="h-auto w-full"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </motion.div>

        {/* Copy side */}
        <motion.div
          className="flex flex-col gap-4 md:[direction:ltr]"
          initial={{ opacity: 0, x: reversed ? -40 : 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ ...springTransition, delay: 0.1 }}
        >
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {title}
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground md:text-lg">
            {description}
          </div>
          <div>
            <Button asChild variant="outline" className="group mt-2">
              <Link href={href}>
                {linkText}
                <ChevronRight
                  size={16}
                  className="ml-1 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
