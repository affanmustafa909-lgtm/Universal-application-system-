import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccessTokenClaims } from "../lib/jwt";

export type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  claims: AccessTokenClaims | null;
  /** Login email (JWT `sub` is user id). */
  email: string | null;
  /** Whether the POS "Select order type" prompt has already been shown this app run. Not persisted — resets whenever the app is closed and reopened. */
  orderTypeModalShown: boolean;
  /** Whether the POS "Select seating section" auto-prompt has already been shown this app run. Not persisted — resets whenever the app is closed and reopened. */
  seatingModalShown: boolean;
  /** Whether the pharmacy POS channel/station/employee gate has been shown this app run. Not persisted. */
  pharmacyPosContextModalShown: boolean;
  /** True when the user is working from a trusted offline identity (JWT may be expired). */
  offlineSession: boolean;
  lastOnlineAt: string | null;
  setOfflineSession: (offline: boolean) => void;
  setTokens: (
    accessToken: string,
    refreshToken: string,
    claims: AccessTokenClaims,
    email?: string | null,
    opts?: { offline?: boolean; lastOnlineAt?: string | null },
  ) => void;
  markOrderTypeModalShown: () => void;
  markSeatingModalShown: () => void;
  markPharmacyPosContextModalShown: () => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      claims: null,
      email: null,
      orderTypeModalShown: false,
      seatingModalShown: false,
      pharmacyPosContextModalShown: false,
      offlineSession: false,
      lastOnlineAt: null,
      setOfflineSession: (offline) =>
        set((s) => ({
          offlineSession: offline,
          lastOnlineAt: offline ? s.lastOnlineAt : new Date().toISOString(),
        })),
      setTokens: (accessToken, refreshToken, claims, email, opts) =>
        set((state) => {
          const offline = Boolean(opts?.offline);
          return {
            accessToken,
            refreshToken,
            claims,
            email: email !== undefined ? email : state.email,
            offlineSession: offline,
            lastOnlineAt: offline
              ? (opts?.lastOnlineAt ?? state.lastOnlineAt)
              : new Date().toISOString(),
          };
        }),
      markOrderTypeModalShown: () => set({ orderTypeModalShown: true }),
      markSeatingModalShown: () => set({ seatingModalShown: true }),
      markPharmacyPosContextModalShown: () => set({ pharmacyPosContextModalShown: true }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          claims: null,
          email: null,
          orderTypeModalShown: false,
          seatingModalShown: false,
          pharmacyPosContextModalShown: false,
          offlineSession: false,
          lastOnlineAt: null,
        }),
    }),
    {
      name: "platform-session-v1",
      // orderTypeModalShown / seatingModalShown / pharmacyPosContextModalShown intentionally excluded —
      // they must reset to false on every fresh app launch, not persist across restarts.
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        claims: s.claims,
        email: s.email,
        offlineSession: s.offlineSession,
        lastOnlineAt: s.lastOnlineAt,
      }),
      // Belt-and-suspenders: force these false after rehydration too, in case an
      // older build already wrote them to disk before they were excluded above.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.orderTypeModalShown = false;
          state.seatingModalShown = false;
          state.pharmacyPosContextModalShown = false;
        }
      },
    },
  ),
);
