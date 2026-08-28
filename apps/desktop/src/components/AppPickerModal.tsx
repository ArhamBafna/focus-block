import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { getAppIcon } from "../lib/app-picker";
import type { AppBlockEntry, AppBlockTarget } from "../lib/ipc";

export interface DiscoveredApp {
  displayName: string;
  target: AppBlockTarget;
  iconDataUri?: string | null;
  category: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onToggleApp: (app: DiscoveredApp) => void;
  blockedApps: Array<DiscoveredApp | AppBlockEntry>;
}

export function AppPickerModal({ isOpen, onClose, onToggleApp, blockedApps }: Props) {
  const [search, setSearch] = useState("");
  const [apps, setApps] = useState<DiscoveredApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && apps.length === 0) {
      setLoading(true);
      setError(null);
      invoke<DiscoveredApp[]>("list_installed_apps")
        .then((res) => {
          setApps(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load apps:", err);
          setError(err as string);
          setLoading(false);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    if (apps.length === 0) return;
    const missing = apps.filter((a) => !a.iconDataUri);
    if (missing.length === 0) return;

    let isMounted = true;
    (async () => {
      for (const app of missing) {
        if (!isMounted) break;
        try {
          const iconUri = await getAppIcon(app.target);
          if (iconUri && isMounted) {
            setApps((prev) =>
              prev.map((item) => {
                const match =
                  (item.target.kind === "executable" &&
                    app.target.kind === "executable" &&
                    item.target.path === app.target.path) ||
                  (item.target.kind === "package" &&
                    app.target.kind === "package" &&
                    item.target.package_family_name === app.target.package_family_name);
                return match ? { ...item, iconDataUri: iconUri } : item;
              })
            );
          }
        } catch {
          // Ignore individual icon extraction failures
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [apps.length]);

  if (!isOpen) return null;

  const filteredApps = apps.filter((app) =>
    app.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(filteredApps.map((a) => a.category))).sort();

  const isBlocked = (app: DiscoveredApp) => {
    return blockedApps.some((b: any) => {
      const bTarget = b.target || b;
      if (app.target.kind === "executable" && bTarget.kind === "executable") {
        return app.target.path === bTarget.path;
      }
      if (app.target.kind === "package" && bTarget.kind === "package") {
        return app.target.package_family_name === bTarget.package_family_name;
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
                              : app.target.kind === "folder"
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
