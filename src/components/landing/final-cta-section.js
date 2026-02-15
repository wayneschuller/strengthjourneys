/** @format */

import { useRouter } from "next/router";
import { useSession, signIn } from "next-auth/react";
import { gaTrackSignInClick } from "@/lib/analytics";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/hero-section";
import FlickeringGrid from "@/components/magicui/flickering-grid";

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 18,
};

export function FinalCTASection() {
  const router = useRouter();
  const { status: authStatus } = useSession();

  return (
    <section className="relative overflow-hidden rounded-2xl py-20 md:py-28">
      {/* FlickeringGrid background */}
      <div className="absolute inset-0 -z-10">
        <FlickeringGrid
          color="rgb(245, 158, 11)"
          maxOpacity={0.12}
          squareSize={4}
          gridGap={6}
          flickerChance={0.3}
        />
      </div>

      <div className="relative flex flex-col items-center gap-6 text-center">
        <motion.h2
          className="text-3xl font-bold tracking-tight md:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={springTransition}
        >
          Build strength that lasts.
        </motion.h2>

        <motion.p
          className="max-w-md text-lg text-muted-foreground"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ...springTransition, delay: 0.08 }}
        >
          Free forever. Open source. Your data stays yours.
        </motion.p>

        {authStatus !== "authenticated" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ...springTransition, delay: 0.16 }}
          >
            <Button
              size="lg"
              className="hover:ring-2"
              onClick={() => {
                gaTrackSignInClick(router.pathname);
                signIn("google");
              }}
            >
              <GoogleLogo />
              Get Started — Free Google Sign-in
            </Button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
