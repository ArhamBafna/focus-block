/**
 * Fake chrome.* environment for service-worker tests.
 *
 * Backs chrome.storage.local with a plain Map, chrome.alarms with recorded
 * calls, and chrome.declarativeNetRequest with an in-memory dynamic-rule
 * store plus counters so tests can assert exactly how many times the rules
 * engine was touched.
 */

export interface ChromeMockHandles {
  /** Backing store behind chrome.storage.local. */
  data: Map<string, unknown>;
  /** In-memory dynamic rules returned by getDynamicRules(). */
  dnrRules: chrome.declarativeNetRequest.Rule[];
  stats: {
    dnrUpdateCalls: number;
    rulesAdded: number;
    rulesRemoved: number;
  };
  createdAlarms: { name: string; info: unknown }[];
  clearedAlarms: string[];
}

export function installChromeMock(): ChromeMockHandles {
  const data = new Map<string, unknown>();
  const dnrRules: chrome.declarativeNetRequest.Rule[] = [];
  const stats = { dnrUpdateCalls: 0, rulesAdded: 0, rulesRemoved: 0 };
  const createdAlarms: { name: string; info: unknown }[] = [];
  const clearedAlarms: string[] = [];

  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  const localArea = {
    get(
      keys: string | string[] | Record<string, unknown> | null,
      callback?: (result: Record<string, unknown>) => void
    ): Promise<Record<string, unknown>> | void {
      const result: Record<string, unknown> = {};
      const collectKey = (key: string, fallback?: unknown) => {
        if (data.has(key)) result[key] = clone(data.get(key));
        else if (fallback !== undefined) result[key] = fallback;
      };
      if (typeof keys === "string") collectKey(keys);
      else if (Array.isArray(keys)) keys.forEach((key) => collectKey(key));
      else if (keys && typeof keys === "object")
        Object.entries(keys).forEach(([key, fallback]) => collectKey(key, fallback));

      if (callback) {
        callback(result);
        return;
      }
      return Promise.resolve(result);
    },
    set(items: Record<string, unknown>, callback?: () => void): Promise<void> | void {
      Object.entries(items).forEach(([key, value]) => data.set(key, clone(value)));
      if (callback) {
        callback();
        return;
      }
      return Promise.resolve();
    },
  };

  const chromeLike = {
    runtime: {
      id: "test-extension-id",
      lastError: undefined as { message?: string } | undefined,
      getManifest: () => ({ version: "0.2.0" }) as { version: string },
      onMessage: { addListener: () => {} },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
    },
    storage: {
      local: localArea,
      sync: localArea,
      session: localArea,
      onChanged: { addListener: () => {} },
    },
    alarms: {
      create: (name: string, info: unknown) => {
        createdAlarms.push({ name, info });
      },
      clear: (name: string) => {
        clearedAlarms.push(name);
        return Promise.resolve(true);
      },
      onAlarm: { addListener: () => {} },
    },
    declarativeNetRequest: {
      ResourceType: { MAIN_FRAME: 0, SUB_FRAME: 1 },
      RuleActionType: { ALLOW: 1, REDIRECT: 2 },
      async getDynamicRules() {
        return dnrRules.map(clone);
      },
      async updateDynamicRules(options: {
        removeRuleIds?: number[];
        addRules?: chrome.declarativeNetRequest.Rule[];
      }) {
        stats.dnrUpdateCalls += 1;
        for (const id of options.removeRuleIds ?? []) {
          const index = dnrRules.findIndex((rule) => rule.id === id);
          if (index !== -1) dnrRules.splice(index, 1);
          stats.rulesRemoved += 1;
        }
        for (const rule of options.addRules ?? []) {
          dnrRules.push(clone(rule));
          stats.rulesAdded += 1;
        }
      },
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = chromeLike;

  return { data, dnrRules, stats, createdAlarms, clearedAlarms };
}
