"use client";

import { useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { mountFriendForge, type FriendForgeController } from "./game/FriendForgeGame";
import "./style.css";

export default function FriendForge({
  friendId,
  client,
  paused,
}: GameComponentProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<FriendForgeController | null>(null);
  const pausedRef = useRef(paused);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"preview" | "chain" | null>(null);
  const [error, setError] = useState("");

  pausedRef.current = paused;

  useEffect(() => {
    let active = true;

    setReady(false);
    setError("");

    void client
      .read()
      .then((snapshot) => {
        if (!active) return;
        if (snapshot.friendId !== friendId) {
          throw new Error("FriendSDK session does not match the selected Friend.");
        }

        setMode(snapshot.mode);

        if (!mountRef.current) return;

        controllerRef.current?.destroy();
        controllerRef.current = mountFriendForge(mountRef.current, {
          friendId,
          getPaused: () => pausedRef.current,
        });

        setReady(true);
      })
      .catch((cause) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not initialize Friend Forge."
        );
      });

    return () => {
      active = false;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [client, friendId]);

  return (
    <section
      className="friend-forge-sdk-shell"
      aria-label="Friend Forge"
      aria-busy={!ready}
    >
      {!ready && !error && (
        <div className="sdk-boot-state" role="status">
          Loading Friend Forge…
        </div>
      )}

      {error && (
        <div className="sdk-boot-state sdk-error" role="alert">
          <strong>FRIEND FORGE SDK ERROR</strong>
          <span>{error}</span>
        </div>
      )}

      <div
        ref={mountRef}
        className="friend-forge-mount"
        aria-hidden={!ready || undefined}
      />

      {ready && (
        <div className="sdk-mode-badge">
          {mode === "chain" ? "CHAIN" : "SIMULATED PREVIEW"} · FRIEND #
          {friendId.toString()}
        </div>
      )}

      {paused && ready && (
        <div className="sdk-paused-overlay" role="status">
          <strong>SDK PAUSED</strong>
          <span>Close the FriendSDK menu to resume the island.</span>
        </div>
      )}
    </section>
  );
}
