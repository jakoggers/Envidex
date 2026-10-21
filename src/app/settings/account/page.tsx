"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { clearEnvidexCachesOnLogout, useEnvidexStore } from "@/lib/store";

const AVATAR_EMOJIS = [
  "🦁","🐯","🦊","🐺","🦝","🐻","🐼","🐨","🦘","🦙",
  "🦒","🦓","🐘","🦏","🦬","🦌","🐇","🦔","🐿️","🦫",
  "🦅","🦉","🦆","🐦","🦜","🐸","🐊","🐢","🦎","🐍",
  "🐬","🦭","🦈","🐙","🐠","🦋","🐝","🌿","🌺","🍀",
];


const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function SaveButton({ saving, saved, disabled }: { saving: boolean; saved: boolean; disabled: boolean }) {
  return (
    <motion.button
      type="submit"
      disabled={disabled || saving}
      whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-sm transition-colors ${
        saved
          ? "bg-primary/20 text-primary border border-primary/30"
          : "bg-primary text-primary-foreground disabled:opacity-40"
      }`}
    >
      {saved ? (
        <><Check className="h-4 w-4" /> Saved</>
      ) : saving ? "Saving…" : "Save changes"}
    </motion.button>
  );
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-red-400 mt-1">{message}</p>;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const { avatarEmoji, setAvatarEmoji } = useEnvidexStore();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  // Name form
  const [name, setName] = useState(session?.user?.name ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Email form
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);


  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => setHasPassword(d.hasPassword ?? false))
      .catch(() => setHasPassword(false));
  }, []);

  const handleName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || nameSaving) return;
    setNameSaving(true);
    setNameError(null);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "name", name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      await update({ name: name.trim() });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setNameSaving(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !emailPassword || emailSaving) return;
    setEmailSaving(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", email: email.trim(), currentPassword: emailPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      await update({ email: email.trim() });
      setEmailPassword("");
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters");
      return;
    }
    if (!currentPassword || pwSaving) return;
    setPwSaving(true);
    setPwError(null);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "password", currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwSaved(true);
      // Password change bumps tokenVersion — prior JWTs are revoked; re-auth required.
      if (data.sessionRevoked) {
        clearEnvidexCachesOnLogout();
        await signOut({ callbackUrl: "/login" });
        return;
      }
      setTimeout(() => setPwSaved(false), 2000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPwSaving(false);
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
          Change information
        </h1>
      </div>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-6 px-4 pb-10"
      >
        {/* Avatar preview */}
        <motion.div variants={fadeUp} className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
            {avatarEmoji ? (
              <span className="text-3xl">{avatarEmoji}</span>
            ) : session?.user?.image ? (
              <img src={session.user.image} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-primary">
                {(name || "E").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{name || "Explorer"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{session?.user?.email}</p>
          </div>
        </motion.div>

        {/* Avatar emoji picker */}
        <motion.div variants={fadeUp} className="flex flex-col gap-3">
          <SectionLabel>Avatar</SectionLabel>
          <div className="rounded-2xl border border-border/40 bg-card/40 p-3">
            <div className="grid grid-cols-8 gap-1.5">
              {AVATAR_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setAvatarEmoji(avatarEmoji === emoji ? null : emoji)}
                  className={`h-9 w-full rounded-xl flex items-center justify-center text-xl transition-colors ${
                    avatarEmoji === emoji
                      ? "bg-primary/20 ring-1 ring-primary/50"
                      : "hover:bg-white/5"
                  }`}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
            {avatarEmoji && (
              <button
                type="button"
                onClick={() => setAvatarEmoji(null)}
                className="mt-2 w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Remove avatar
              </button>
            )}
          </div>
        </motion.div>

        {/* Display name */}
        <motion.form variants={fadeUp} onSubmit={handleName} className="flex flex-col gap-3">
          <SectionLabel>Display name</SectionLabel>
          <div className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden px-4 py-3.5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="Your name"
              className="w-full bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>
          <FieldError message={nameError} />
          <SaveButton
            saving={nameSaving}
            saved={nameSaved}
            disabled={!name.trim() || name.trim() === session?.user?.name}
          />
        </motion.form>

        {/* Email */}
        <motion.form variants={fadeUp} onSubmit={handleEmail} className="flex flex-col gap-3">
          <SectionLabel>Email address</SectionLabel>
          {hasPassword === false ? (
            <p className="text-xs text-muted-foreground bg-card/40 border border-border/40 rounded-2xl px-4 py-3.5">
              Email is managed by your social login provider and cannot be changed here.
            </p>
          ) : (
            <>
              <div className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden divide-y divide-border/30">
                <div className="px-4 py-3.5">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="New email address"
                    className="w-full bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>
                <div className="px-4 py-3.5">
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Current password to confirm"
                    className="w-full bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>
              </div>
              <FieldError message={emailError} />
              <SaveButton
                saving={emailSaving}
                saved={emailSaved}
                disabled={!email.trim() || !emailPassword || email.trim() === session?.user?.email}
              />
            </>
          )}
        </motion.form>

        {/* Password */}
        <motion.form variants={fadeUp} onSubmit={handlePassword} className="flex flex-col gap-3">
          <SectionLabel>Password</SectionLabel>
          {hasPassword === false ? (
            <p className="text-xs text-muted-foreground bg-card/40 border border-border/40 rounded-2xl px-4 py-3.5">
              Password login is not enabled for your account.
            </p>
          ) : (
            <>
              <div className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden divide-y divide-border/30">
                <div className="flex items-center px-4 py-3.5 gap-3">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                  <button type="button" onClick={() => setShowCurrent((v) => !v)} className="text-muted-foreground/60 shrink-0">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center px-4 py-3.5 gap-3">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                  <button type="button" onClick={() => setShowNew((v) => !v)} className="text-muted-foreground/60 shrink-0">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="px-4 py-3.5">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>
              </div>
              <FieldError message={pwError} />
              <SaveButton
                saving={pwSaving}
                saved={pwSaved}
                disabled={!currentPassword || !newPassword || !confirmPassword}
              />
            </>
          )}
        </motion.form>

      </motion.div>
    </div>
  );
}
