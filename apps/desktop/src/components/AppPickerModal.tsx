import { useState, useEffect, useRef } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { X } from "@phosphor-icons/react/X";
import { motion, AnimatePresence } from "framer-motion";
import { getAppIcon, listInstalledApps, type DiscoveredApp } from "../lib/app-picker";
import type { AppBlockEntry } from "../lib/ipc";

export type { DiscoveredApp };

// Icon answers, kept at module scope because AnimatePresence unmounts the modal
// on close and a keystroke aborts the effect that was filling the list. Without
// this, an aborted batch would throw away icons it had already extracted and the
// apps would be stuck on a letter placeholder.
//
//   iconCache       – a real icon, reused on reopen with no IPC at all (bounded LRU)
//   noIconFailures  – extraction returned nothing; retried only after TTL expires
//   inFlight        – keys a running batch is already working on
const MAX_ICON_CACHE = 200;
const MAX_FAILURES_CACHE = 200;
const NO_ICON_TTL_MS = 5 * 60 * 1000;
const iconCache = new Map<string, string>();
const noIconFailures = new Map<string, number>();
const inFlight = new Set<string>();

function getCachedIcon(key: string): string | undefined {
  const uri = iconCache.get(key);
  if (uri !== undefined) {
    iconCache.delete(key);
    iconCache.set(key, uri);
  }
  return uri;
}

function cacheIcon(key: string, iconUri: string) {
  if (iconCache.has(key)) {
    iconCache.delete(key);
  } else if (iconCache.size >= MAX_ICON_CACHE) {
    const oldestKey = iconCache.keys().next().value;
    if (oldestKey) iconCache.delete(oldestKey);
  }
  iconCache.set(key, iconUri);
}

function recordNoIconFailure(key: string) {
  if (noIconFailures.has(key)) {
    noIconFailures.delete(key);
  } else if (noIconFailures.size >= MAX_FAILURES_CACHE) {
    const oldestKey = noIconFailures.keys().next().value;
    if (oldestKey) noIconFailures.delete(oldestKey);
  }
  noIconFailures.set(key, Date.now());
}

function hasFreshNoIcon(key: string): boolean {
  const failedAt = noIconFailures.get(key);
  if (!failedAt) return false;
  if (Date.now() - failedAt > NO_ICON_TTL_MS) {
    noIconFailures.delete(key);
    return false;
  }
  return true;
}

const iconKey = (app: DiscoveredApp) =>
  app.target.kind === "executable"
    ? app.target.path.toLowerCase()
    : app.target.package_family_name.toLowerCase();

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onToggleApp: (app: DiscoveredApp) => void;
  blockedApps: Array<DiscoveredApp | AppBlockEntry>;
}

export function AppPickerModal({ isOpen, onClose, onToggleApp, blockedApps }: Props) {
  const isComponentMounted = useRef(true);
  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
    };
  }, []);

  const [search, setSearch] = useState("");
  const [apps, setApps] = useState<DiscoveredApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && apps.length === 0) {
      setLoading(true);
      setError(null);
      listInstalledApps()
        .then((res) => {
          if (!isComponentMounted.current) return;
          setApps(res);
          setLoading(false);
        })
        .catch((err) => {
          if (!isComponentMounted.current) return;
          console.error("Failed to load apps:", err);
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        });
    }
  }, [isOpen]);

  const filteredApps = apps.filter((app) =>
    app.displayName.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!isOpen || apps.length === 0) return;

    // Icons extracted by a batch that a keystroke aborted are already in
    // `iconCache`; apply them before deciding what still needs work.
    if (apps.some((a) => !a.iconDataUri && iconCache.has(iconKey(a)))) {
      setApps((prev) =>
        prev.map((item) => {
          const cached = getCachedIcon(iconKey(item));
          return !item.iconDataUri && cached ? { ...item, iconDataUri: cached } : item;
        })
      );
    }

    // Every visible app gets an icon: a hard cap would leave everything past the
    // first batch with a letter placeholder forever, because this effect only
    // re-runs when the app list or the search term changes. Batching keeps the
    // UI responsive instead of capping the work.
    const missing = filteredApps.filter(
      (a) =>
        !a.iconDataUri &&
        !iconCache.has(iconKey(a)) &&
        !hasFreshNoIcon(iconKey(a)) &&
        !inFlight.has(iconKey(a))
    );
    if (missing.length === 0) return;

    let isMounted = true;
    (async () => {
      const chunkSize = 4;
      for (let i = 0; i < missing.length; i += chunkSize) {
        if (!isMounted) break;
        const chunk = missing.slice(i, i + chunkSize);
        chunk.forEach((app) => inFlight.add(iconKey(app)));
        const results = await Promise.all(
          chunk.map(async (app) => {
            try {
              return { app, iconUri: await getAppIcon(app.target) };
            } catch {
              return { app, iconUri: null };
            }
          })
        );
        // The answers belong to the app, not to this render, so they are kept and
        // applied even when the run was aborted by a keystroke: dropping them
        // would leave a visible app on a letter placeholder until something else
        // happened to re-render. Only starting the next chunk is skipped.
        for (const { app, iconUri } of results) {
          const key = iconKey(app);
          inFlight.delete(key);
          if (iconUri) {
            cacheIcon(key, iconUri);
            noIconFailures.delete(key);
          } else {
            recordNoIconFailure(key);
          }
        }
        const updates = results.filter(
          (r): r is { app: DiscoveredApp; iconUri: string } => !!r.iconUri
        );
        if (isComponentMounted.current && updates.length > 0) {
          setApps((prev) =>
            prev.map((item) => {
              const found = updates.find(
                (u) =>
                  (item.target.kind === "executable" &&
                    u.app.target.kind === "executable" &&
                    item.target.path === u.app.target.path) ||
                  (item.target.kind === "package" &&
                    u.app.target.kind === "package" &&
                    item.target.package_family_name === u.app.target.package_family_name)
              );
              return found ? { ...item, iconDataUri: found.iconUri } : item;
            })
          );
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, apps.length, search]);

  const categories = Array.from(new Set(filteredApps.map((a) => a.category))).sort();

  const isBlocked = (app: DiscoveredApp) => {
    return blockedApps.some((b: any) => {
      const bTarget = b.target || b;
      if (app.target.kind === "executable" && bTarget.kind === "executable") {
        return (
          app.target.path.toLowerCase() === bTarget.path.toLowerCase()
        );
      }
      if (app.target.kind === "package" && bTarget.kind === "package") {
        return (
          app.target.package_family_name.toLowerCase() ===
          bTarget.package_family_name.toLowerCase()
        );
      }
      return false;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-['Figtree']">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-3xl max-h-[85vh] bg-[#1a1a1a] rounded-2xl shadow-2xl flex flex-col border border-[#333333] overflow-hidden"
          >
            {/* Header & Sticky Search */}
            <div className="sticky top-0 z-10 bg-[#1a1a1a]/90 backdrop-blur-md border-b border-[#333333] p-6 pt-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-3xl font-medium text-white tracking-tight">Block Applications</h2>
                  <p className="text-[#8a8a80] mt-1 text-sm">Select apps to block during your focus sessions.</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-[#8a8a80] hover:text-white transition-colors bg-[#333333]/50 hover:bg-[#333333] rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative">
                <MagnifyingGlass
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a80]"
                />
                <input
                  type="text"
                  placeholder="Search apps..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#000000] border border-[#333333] text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#f0d7ff] focus:ring-1 focus:ring-[#f0d7ff] transition-all placeholder:text-[#8a8a80]"
                />
              </div>
            </div>

            {/* App List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-[#f0d7ff] border-t-transparent rounded-full" />
                </div>
              ) : error ? (
                <div className="text-[#ffa946] text-center py-10 bg-[#ffa946]/10 rounded-xl">
                  Failed to load applications: {error}
                </div>
              ) : filteredApps.length === 0 ? (
                <div className="text-[#8a8a80] text-center py-20">
                  No applications found matching "{search}"
                </div>
              ) : (
                categories.map((category) => (
                  <div key={category}>
                    <h3 className="text-[#8a8a80] text-xs font-semibold uppercase tracking-wider mb-4 px-1">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredApps
                        .filter((a) => a.category === category)
                        .map((app, idx) => {
                          const active = isBlocked(app);
                          const targetKey =
                            app.target.kind === "executable"
                              ? app.target.path
                              : app.target.package_family_name;
                          return (
                            <div
                              key={`${app.target.kind}-${targetKey}-${idx}`}
                              className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                                active
                                  ? "bg-[#034f46]/20 border-[#034f46]"
                                  : "bg-[#000000] border-[#333333] hover:border-[#8a8a80]"
                              }`}
                              onClick={() => onToggleApp(app)}
                            >
                              <div className="flex items-center gap-4 overflow-hidden">
                                <div className="w-10 h-10 rounded-lg bg-[#333333] flex items-center justify-center shrink-0">
                                  {app.iconDataUri ? (
                                    <img src={app.iconDataUri} alt="" className="w-6 h-6" />
                                  ) : (
                                    <span className="text-lg text-[#8a8a80]">
                                      {app.displayName.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span className="text-white font-medium truncate">
                                  {app.displayName}
                                </span>
                              </div>

                              <div
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  active ? "bg-[#f0d7ff] shadow-[0_0_12px_rgba(240,215,255,0.4)]" : "bg-[#333333]"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    active ? "translate-x-6" : "translate-x-1"
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
