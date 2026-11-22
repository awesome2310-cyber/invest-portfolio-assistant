"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBook } from "@/lib/desk/book";
import type { DeskBook, DeskRecord } from "@/lib/desk/book";
import { assetUrl } from "@/lib/asset";
import type { MarketSnapshot } from "@/lib/market/snapshot";
import { readDesk } from "@/lib/storage";

export function useDesk() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [record, setRecord] = useState<DeskRecord | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancel = false;
    const sync = () => setRecord(readDesk());
    sync();
    window.addEventListener("sathorn-desk", sync);
    fetch(assetUrl("/market/snapshot.json"))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<MarketSnapshot>;
      })
      .then((data) => {
        if (!cancel) {
          setSnapshot(data);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (!cancel) setPhase("error");
      });
    return () => {
      cancel = true;
      window.removeEventListener("sathorn-desk", sync);
    };
  }, []);

  const book = useMemo(() => (snapshot && record ? buildBook(record, snapshot) : null), [snapshot, record]);
  return { phase, snapshot, record, book };
}

export type { DeskBook };
