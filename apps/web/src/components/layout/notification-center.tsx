"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

import type { NotificationsResponse } from "@/lib/api/contracts";

/* Client-only mount flag for the portal without setState-in-effect.
   Server snapshot is false; client snapshot is true — no DOM access during SSR. */
const noopSubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/* Panel dimensions kept in sync with the .notification-center-panel CSS rule. */
const PANEL_WIDTH = 360;
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 10;

interface PanelPosition {
  left: number;
  top: number;
}

export function NotificationCenter({
  notifications,
  onMarkRead,
}: {
  notifications: NotificationsResponse | null;
  onMarkRead: (id: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useIsMounted();
  const [position, setPosition] = useState<PanelPosition>({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications?.unreadCount ?? 0;

  /* Anchor the fixed panel to the bell: escape the sidebar to the right, bottom-aligned,
     and clamp so it never spills off the right edge or below the viewport. */
  const reposition = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);

    let left = rect.right + ANCHOR_GAP;
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
    if (left > maxLeft) {
      // Not enough room to the right (e.g. narrow viewport) — flip to the left of the bell.
      left = Math.max(VIEWPORT_MARGIN, rect.left - width - ANCHOR_GAP);
    }
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), maxLeft);

    // Bottom-align the panel to the bell, then clamp within the viewport vertically.
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    let top = rect.bottom - panelHeight;
    const maxTop = window.innerHeight - VIEWPORT_MARGIN;
    top = Math.min(top, maxTop - panelHeight);
    top = Math.max(VIEWPORT_MARGIN, top);

    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition, notifications]);

  useEffect(() => {
    if (!open) return;

    function handleScroll() {
      reposition();
    }
    function handleResize() {
      reposition();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open, reposition]);

  return (
    <div className="notification-center">
      <motion.button
        ref={buttonRef}
        type="button"
        className={`notification-center-button${unreadCount > 0 ? " notification-center-button--unread" : ""}`}
        onClick={() => setOpen((c) => !c)}
        aria-expanded={open}
        aria-label="Notifications"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
      >
        <motion.span
          key={unreadCount}
          animate={unreadCount > 0 ? { rotate: [0, -14, 11, -8, 5, 0] } : { rotate: 0 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <BellIcon size={15} />
        </motion.span>

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              className="notification-center-count"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              {unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                className="notification-center-panel"
                role="dialog"
                aria-label="Notifications"
                style={{ left: position.left, top: position.top }}
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                <div className="notification-center-header">
                  <span className="notification-center-title">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="notification-center-unread-chip">{unreadCount} unread</span>
                  )}
                </div>

                {notifications?.items.length ? (
                  notifications.items.map((notification, i) => (
                    <motion.div
                      key={notification.id}
                      className={`notification-center-item${notification.readAt ? " notification-center-item--read" : ""}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                    >
                      <div className="notification-center-item-body">
                        <strong>{notification.title}</strong>
                        <p>{notification.body}</p>
                        <span>{notification.eventCode}</span>
                      </div>
                      {notification.readAt ? (
                        <span className="notification-center-state">Read</span>
                      ) : (
                        <button
                          type="button"
                          className="notification-center-action"
                          onClick={() => void onMarkRead(notification.id)}
                        >
                          Mark read
                        </button>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <motion.p
                    className="notification-center-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    All caught up.
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
