import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldSlash, X, ArrowLeft } from "@phosphor-icons/react";
import type { BlockedAppEvent } from "../lib/ipc";

interface Props {
  event: BlockedAppEvent | null;
  isOpen: boolean;
  onDismiss: () => void;
  onBackToFocus: () => void;
}

export function AppBlockedModal({
  event,
  isOpen,
  onDismiss,
  onBackToFocus,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        primaryButtonRef.current?.focus();
      }, 0);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onDismissRef.current();
          return;
        }

        if (e.key === "Tab") {
          if (!dialogRef.current) return;
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("keydown", handleKeyDown);
        if (previousActiveElement.current && typeof previousActiveElement.current.focus === "function") {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen]);

  if (!isOpen || !event) return null;

  const appName = event.app_name || "Application";
  const count = event.count || 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="blocked-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md font-['Figtree']"
        >
          <motion.div
            key={appName}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
            className="relative w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-2xl p-7 flex flex-col items-center text-center border border-[#333333] overflow-hidden"
            style={{
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(240, 215, 255, 0.08)",
            }}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close alert"
              className="absolute top-4 right-4 p-2 text-[#8a8a80] hover:text-white transition-colors bg-[#2a2a2a] hover:bg-[#333333] rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Icon Header */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: "linear-gradient(135deg, rgba(240, 215, 255, 0.2) 0%, rgba(3, 79, 70, 0.3) 100%)",
                border: "1px solid rgba(240, 215, 255, 0.3)",
              }}
            >
              <ShieldSlash size={32} weight="duotone" color="#f0d7ff" />
            </div>

            {/* Title & App Name */}
            <h2
              id="blocked-modal-title"
              className="text-2xl font-semibold text-white tracking-tight mb-2"
            >
              {appName} Blocked
            </h2>

            <p className="text-[#a0a095] text-sm leading-relaxed mb-6 max-w-xs">
              FocusBlock closed <span className="text-white font-medium">{appName}</span> to protect your focus session. Stay in your flow!
            </p>

            {/* Debounce / Attempt badge if user launched multiple times */}
            {count > 1 && (
              <div
                className="mb-6 px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(240, 215, 255, 0.12)",
                  color: "#f0d7ff",
                  border: "1px solid rgba(240, 215, 255, 0.25)",
                }}
              >
                Blocked {count} launch attempts
              </div>
            )}

            {/* Actions: Primary "Back to Focus" button */}
            <div className="w-full flex flex-col gap-3">
              <button
                ref={primaryButtonRef}
                type="button"
                onClick={onBackToFocus}
                className="w-full py-3 px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, #f0d7ff 0%, #e3bbff 100%)",
                  color: "#1a1a1a",
                  boxShadow: "0 4px 14px rgba(240, 215, 255, 0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(240, 215, 255, 0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(240, 215, 255, 0.25)";
                }}
              >
                <ArrowLeft size={16} weight="bold" />
                Back to Focus
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
