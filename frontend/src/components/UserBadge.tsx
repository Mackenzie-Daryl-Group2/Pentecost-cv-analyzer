"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabase";

type UserLike = {
  email?: string | null;
  user_metadata?: {
    avatar_url?: string | null;
    full_name?: string | null;
    name?: string | null;
    picture?: string | null;
  } | null;
};

function initialsFromName(name?: string | null) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "PU";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function displayNameForUser(user?: UserLike | null, fallback = "Pentecost User") {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || fallback;
}

export function Avatar({ name, src, size = 40 }: { name?: string | null; src?: string | null; size?: number }) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.34)),
      }}
      aria-hidden="true"
    >
      {initialsFromName(name)}
      {src && (
        <img
          src={src}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}

export default function UserBadge({
  user,
  label,
  onUserUpdated,
}: {
  user?: UserLike | null;
  label?: string;
  onUserUpdated?: (user: UserLike | null) => void;
}) {
  const displayName = displayNameForUser(user);
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState(user?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "password" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEmail(user?.email || "");
  }, [user?.email]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function refreshCurrentUser() {
    const { data } = await supabase.auth.getUser();
    onUserUpdated?.((data.user as UserLike | null) || null);
  }

  async function handleEmailUpdate(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    const nextEmail = email.trim();
    if (!nextEmail || !nextEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    if (nextEmail === user?.email) {
      setError("That is already the email on this account.");
      return;
    }

    setBusy("email");
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    setBusy("");

    if (error) {
      setError(error.message);
      return;
    }

    await refreshCurrentUser();
    setMessage("Email change requested. Check your email to confirm the update if Supabase requires verification.");
  }

  async function handlePasswordUpdate(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy("password");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy("");

    if (error) {
      setError(error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password updated successfully.");
  }

  return (
    <>
      <button type="button" className="user-badge" onClick={() => setIsOpen(true)} title="Account settings">
        <Avatar name={displayName} src={avatarUrl} />
        <div>
          <strong>{displayName}</strong>
          <span>{label || user?.email || "Signed in"}</span>
        </div>
      </button>

      {mounted && isOpen && createPortal(
        <div className="account-modal-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            className="account-modal glass-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="account-modal-header">
              <div>
                <p className="eyebrow">Account</p>
                <h2 id="account-settings-title">Account Settings</h2>
                <p className="status-note">{user?.email || "Signed in account"}</p>
              </div>
              <button type="button" className="modal-icon-button" onClick={() => setIsOpen(false)} aria-label="Close account settings">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {(message || error) && (
              <div className={error ? "account-message error" : "account-message"}>
                {error || message}
              </div>
            )}

            <form onSubmit={handleEmailUpdate} className="account-section">
              <div>
                <h3>Email Address</h3>
              </div>
              <input className="input-field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
              <button className="premium-button" type="submit" disabled={busy === "email"}>
                {busy === "email" ? "Saving..." : "Change Email"}
              </button>
            </form>

            <form onSubmit={handlePasswordUpdate} className="account-section">
              <div>
                <h3>Password</h3>
                <p>Use at least 6 characters for the new password.</p>
              </div>
              <input className="input-field" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" />
              <input className="input-field" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" />
              <button className="premium-button" type="submit" disabled={busy === "password"}>
                {busy === "password" ? "Saving..." : "Change Password"}
              </button>
            </form>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
