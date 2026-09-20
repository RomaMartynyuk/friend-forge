import { useEffect, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import "./style.css";

export default function FriendForge({
  friendId,
  client,
  paused,
}: GameComponentProps) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"preview" | "chain" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        const snapshot = await client.read();

        if (!active) return;

        setMode(snapshot.mode);
        setReady(true);
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to initialize FriendSDK session"
        );
      }
    }

    void boot();

    return () => {
      active = false;
    };
  }, [client]);

  if (error) {
    return (
      <main className="sdk-check">
        <h1>FRIEND FORGE</h1>
        <p className="error">SDK ERROR</p>
        <pre>{error}</pre>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="sdk-check">
        <h1>FRIEND FORGE</h1>
        <p>Loading Friend...</p>
      </main>
    );
  }

  return (
    <main className="sdk-check">
      <div className="sdk-card">
        <div className="kicker">FRIEND FORGE · v0.3.1</div>

        <h1>SDK CONNECTED</h1>

        <div className="sdk-row">
          <span>FRIEND ID</span>
          <strong>#{friendId.toString()}</strong>
        </div>

        <div className="sdk-row">
          <span>MODE</span>
          <strong>{mode?.toUpperCase()}</strong>
        </div>

        <div className="sdk-row">
          <span>GAME INPUT</span>
          <strong>{paused ? "PAUSED" : "ACTIVE"}</strong>
        </div>

        <p className="note">
          Next: mount the Friend Forge island and replace the temporary
          character with the selected Rare Friend.
        </p>
      </div>
    </main>
  );
}