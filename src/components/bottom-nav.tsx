"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookOpen, User, Home, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/live-feed", icon: Radio, label: "Identify" },
  { href: "/collection", icon: BookOpen, label: "Field Guide" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { status } = useSession();

  if (pathname === "/login" || pathname === "/signup" || status !== "authenticated") {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
      <div className="mx-3 mb-3 rounded-2xl border border-border bg-card/90 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <motion.div
                key={item.href}
                whileTap={{ scale: 0.75 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
              >
                <Link href={item.href} className="relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors group">
                  {active && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 bg-primary/15 rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-colors relative z-10",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-medium relative z-10 transition-colors",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
