"use client";

import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { clearEnvidexCachesOnLogout, useEnvidexStore } from "@/lib/store";
import { ArrowLeft, LogOut, ChevronRight, User, Trash2, Info, FileText, Shield, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground px-5 mb-2">{title}</p>
      <div className="mx-4 rounded-2xl border border-border/40 bg-card/40 overflow-hidden">
        {children}
      </div>
    </motion.div>
  );
}

function Row({
  label,
  sublabel,
  left,
  right,
  onClick,
  destructive,
}: {
  label: string;
  sublabel?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left
        [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border/30
        ${onClick ? "hover:bg-white/5 active:bg-white/10" : "cursor-default"}
        ${destructive ? "text-red-400" : "text-foreground"}
      `}
    >
      {left && <span className="shrink-0 text-muted-foreground">{left}</span>}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${destructive ? "text-red-400" : ""}`}>{label}</p>
        {sublabel && <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      {right ?? (onClick && !destructive && <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />)}
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { avatarEmoji } = useEnvidexStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSignOut = async () => {
    clearEnvidexCachesOnLogout();
    await signOut({ callbackUrl: "/login" });
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setDeleteError(null);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/user", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      }
      clearEnvidexCachesOnLogout();
      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      setDeleting(false);
      setConfirmDelete(false);
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-6">
        <motion.button
          type="button"
          onClick={() => router.back()}
          whileTap={{ scale: 0.88 }}
          className="h-9 w-9 rounded-full border border-border/60 bg-card/60 flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </motion.button>
        <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Settings
        </h1>
      </div>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-6 pb-10"
      >
        {/* Account */}
        <Section title="Account">
          <Row
            label={session?.user?.name ?? "Explorer"}
            sublabel={session?.user?.email ?? ""}
            left={
              avatarEmoji ? (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                  {avatarEmoji}
                </div>
              ) : session?.user?.image ? (
                <img src={session.user.image} className="h-8 w-8 rounded-full object-cover" alt="" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  {(session?.user?.name ?? "E").charAt(0).toUpperCase()}
                </div>
              )
            }
          />
          <Row
            label="Change information"
            sublabel="Update your name, email, or password"
            left={<User className="h-4 w-4" />}
            onClick={() => router.push("/settings/account")}
          />
        </Section>

        {/* About */}
        <Section title="About">
          <Row
            label="Version"
            sublabel="Envidex"
            left={<Info className="h-4 w-4" />}
            right={<span className="text-xs text-muted-foreground font-mono">1.0.0</span>}
          />
          <Row
            label="Privacy Policy"
            left={<Shield className="h-4 w-4" />}
            onClick={() => window.open("/privacy", "_blank")}
          />
          <Row
            label="Terms of Service"
            left={<FileText className="h-4 w-4" />}
            onClick={() => window.open("/terms", "_blank")}
          />
          <Row
            label="Send feedback"
            sublabel="Report a bug or share a suggestion"
            left={<MessageSquare className="h-4 w-4" />}
            onClick={() => window.open("mailto:feedback@envidex.app", "_blank")}
          />
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Dark / Light mode</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Switch the app theme</p>
            </div>
            <ThemeToggle className="h-9 w-9 rounded-full border border-border/60 bg-card/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" />
          </div>
        </Section>

        {/* Account actions */}
        <Section title="Account actions">
          <Row
            label="Sign out"
            left={<LogOut className="h-4 w-4" />}
            destructive
            onClick={() => void handleSignOut()}
            right={null}
          />
        </Section>

        <motion.p variants={fadeUp} className="text-center text-[10px] text-muted-foreground/40 px-5">
          Photos you save are stored privately on the server. Local model scores are uncalibrated.
        </motion.p>

        <Section title="Danger zone">
          <Row
            label={deleting ? "Deleting…" : confirmDelete ? "Tap again to confirm" : "Delete account"}
            sublabel="Permanently removes your account and private observations"
            left={<Trash2 className="h-4 w-4" />}
            destructive
            onClick={deleting ? undefined : () => void handleDeleteAccount()}
            right={null}
          />
        </Section>
        {deleteError && (
          <p className="px-5 text-sm text-red-400" role="alert">
            Could not delete account: {deleteError}
          </p>
        )}
      </motion.div>
    </div>
  );
}
