/**
 * FocusBlock Chrome MV3 service worker.
 *
 * Desktop service owns focus state. This worker stores only last service policy
 * snapshot, turns it into Chrome DNR rules, and rehydrates rules after worker
 * restart. Native-host failure never clears last known policy.
 */

type SessionMode = "blocklist" | "lockdown";

interface FocusBlockPolicySnapshot {
  active: boolean;
  mode: SessionMode;
  blocklist: string[];
  whitelist: string[];
  blocked_domains: string[];
  allowed_domains: string[];
  version: string;
  expires_at: string | number | null;
}

interface ServiceRequestMessage {
  type: "focusblock-service-request";
  request: {
    cmd: string;
    data?: unknown;
  };
}

interface IpcResponse {
  status: "Ok" | "Err";
  data?: unknown;
  message?: string;
}

const NATIVE_HOST_NAME = "com.focusblock.bridge";
const POLICY_SNAPSHOT_KEY = "focusblockPolicySnapshot";
const POLICY_SYNC_ALARM = "focusblock-policy-sync";
const BLOCKED_PAGE_PATH = "/blocked/index.html";
const FOCUSBLOCK_RULE_ID_MIN = 1;
const FOCUSBLOCK_RULE_ID_MAX = 30_000;

const LEGACY_STORAGE_KEYS = [
  "active_session",
  "active_challenge",
  "blocklist",
  "whitelist",
  "temporary_allowlist",
  "schedules",
  "history",
  "schedule_suppressed_until",
  "settings",
  "presets",
];

const SERVICE_COMMANDS = new Set([
  "Ping",
  "Health",
  "GetStatus",
  "ListBlocklist",
  "AddBlocklist",
  "RemoveBlocklist",
  "ListWhitelist",
  "AddWhitelist",
  "RemoveWhitelist",
  "ListPresets",
  "CreatePreset",
  "DeletePreset",
  "StartSession",
  "StopSession",
  "ListHistory",
  "ClearHistory",
  "GetSettings",
  "UpdateSettings",
]);

const FRAME_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
  chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
];

const LOADED_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  chrome.declarativeNetRequest.ResourceType.STYLESHEET,
  chrome.declarativeNetRequest.ResourceType.SCRIPT,
  chrome.declarativeNetRequest.ResourceType.IMAGE,
  chrome.declarativeNetRequest.ResourceType.FONT,
  chrome.declarativeNetRequest.ResourceType.OBJECT,
  chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
  chrome.declarativeNetRequest.ResourceType.PING,
  chrome.declarativeNetRequest.ResourceType.CSP_REPORT,
  chrome.declarativeNetRequest.ResourceType.MEDIA,
  chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
  chrome.declarativeNetRequest.ResourceType.WEBTRANSPORT,
  chrome.declarativeNetRequest.ResourceType.WEBBUNDLE,
  chrome.declarativeNetRequest.ResourceType.OTHER,
];

const ALL_BLOCKABLE_RESOURCE_TYPES = [
  ...FRAME_RESOURCE_TYPES,
  ...LOADED_RESOURCE_TYPES,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return null;
  }
  return value;
}

function parsePolicySnapshot(value: unknown): FocusBlockPolicySnapshot | null {
  if (!isRecord(value) || typeof value.active !== "boolean") return null;
  // A host-generated error is not an inactive policy. Keep prior good snapshot.
  if (typeof value.error === "string" && value.error.length > 0) return null;
  if (value.mode !== "blocklist" && value.mode !== "lockdown") return null;

  const blocklist = stringArray(value.blocklist);
  const whitelist = stringArray(value.whitelist);
  const blockedDomains = stringArray(value.blocked_domains);
  const allowedDomains = stringArray(value.allowed_domains);
  if (!blocklist || !whitelist || !blockedDomains || !allowedDomains) return null;
  if (typeof value.version !== "string") return null;
  if (
    value.expires_at !== null &&
    typeof value.expires_at !== "string" &&
    typeof value.expires_at !== "number"
  ) {
    return null;
  }

  return {
    active: value.active,
    mode: value.mode,
    blocklist,
    whitelist,
    blocked_domains: blockedDomains,
    allowed_domains: allowedDomains,
    version: value.version,
    expires_at: value.expires_at,
  };
}

function targetToUrlFilter(rawTarget: string): string | null {
  const target = rawTarget.trim();
  if (!target) return null;

  if (target.startsWith("http://") || target.startsWith("https://")) {
    try {
      const url = new URL(target);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (!host) return null;
      const path = `${url.pathname}${url.search}`;
      return path === "/" ? `||${host}^` : `|${url.protocol}//${host}${path}`;
    } catch {
      return null;
    }
  }

  if (target.startsWith("*")) {
    const wildcard = target.slice(1).toLowerCase();
    return /^[a-z0-9._/-]+$/.test(wildcard) ? `*${wildcard}*` : null;
  }

  const domain = target.toLowerCase().replace(/^www\./, "");
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(domain)
    ? `||${domain}^`
    : null;
}

function targetFilters(targets: string[]): string[] {
  const filters = new Set<string>();
  for (const target of targets) {
    const filter = targetToUrlFilter(target);
    if (filter) filters.add(filter);
    else console.warn("[FocusBlock] Ignored invalid policy target:", target);
  }
  return [...filters];
}

function appendRule(
  rules: chrome.declarativeNetRequest.Rule[],
  nextId: number,
  priority: number,
  action: chrome.declarativeNetRequest.RuleAction,
  resourceTypes: chrome.declarativeNetRequest.ResourceType[],
  urlFilter?: string,
): number {
  if (nextId > FOCUSBLOCK_RULE_ID_MAX) {
    throw new Error("FocusBlock policy exceeds Chrome dynamic-rule capacity.");
  }

  rules.push({
    id: nextId,
    priority,
    action,
    condition: {
      ...(urlFilter ? { urlFilter } : {}),
      resourceTypes,
    },
  });
  return nextId + 1;
}

function appendAllowRules(
  rules: chrome.declarativeNetRequest.Rule[],
  filters: string[],
  nextId: number,
): number {
  for (const urlFilter of filters) {
    nextId = appendRule(
      rules,
      nextId,
      4,
      { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
      ALL_BLOCKABLE_RESOURCE_TYPES,
      urlFilter,
    );
  }
  return nextId;
}

function appendBlockedTargetRules(
  rules: chrome.declarativeNetRequest.Rule[],
  filters: string[],
  nextId: number,
): number {
  for (const urlFilter of filters) {
    nextId = appendRule(
      rules,
      nextId,
      2,
      {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: { extensionPath: BLOCKED_PAGE_PATH },
      },
      FRAME_RESOURCE_TYPES,
      urlFilter,
    );
    nextId = appendRule(
      rules,
      nextId,
      2,
      { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      LOADED_RESOURCE_TYPES,
      urlFilter,
    );
  }
  return nextId;
}

function buildPolicyRules(policy: FocusBlockPolicySnapshot): chrome.declarativeNetRequest.Rule[] {
  if (!policy.active) return [];

  const blocked = targetFilters([...policy.blocklist, ...policy.blocked_domains]);
  const allowed = targetFilters([...policy.whitelist, ...policy.allowed_domains]);
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let nextId = FOCUSBLOCK_RULE_ID_MIN;

  nextId = appendAllowRules(rules, allowed, nextId);

  if (policy.mode === "lockdown") {
    nextId = appendRule(
      rules,
      nextId,
      1,
      {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: { extensionPath: BLOCKED_PAGE_PATH },
      },
      FRAME_RESOURCE_TYPES,
    );
    appendRule(
      rules,
      nextId,
      1,
      { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      LOADED_RESOURCE_TYPES,
    );
  } else {
    appendBlockedTargetRules(rules, blocked, nextId);
  }

  return rules;
}

function isFocusBlockRuleId(id: number): boolean {
  return id >= FOCUSBLOCK_RULE_ID_MIN && id <= FOCUSBLOCK_RULE_ID_MAX;
}

async function updateFocusBlockRules(rules: chrome.declarativeNetRequest.Rule[]): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules
    .filter((rule) => isFocusBlockRuleId(rule.id))
    .map((rule) => rule.id);

  // Chrome applies removal and addition as one atomic DNR transaction.
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: rules });
  console.info(`[FocusBlock] DNR policy rebuilt: ${rules.length} rules.`);
}

async function applyPolicySnapshot(policy: FocusBlockPolicySnapshot): Promise<void> {
  await updateFocusBlockRules(buildPolicyRules(policy));
}

async function restoreStoredPolicy(): Promise<void> {
  const stored = await chrome.storage.local.get(POLICY_SNAPSHOT_KEY);
  const policy = parsePolicySnapshot(stored[POLICY_SNAPSHOT_KEY]);
  if (!policy) {
    await updateFocusBlockRules([]);
    return;
  }
  await applyPolicySnapshot(policy);
}

async function refreshPolicyFromService(): Promise<boolean> {
  try {
    const nativeResponse = await chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, {
      type: "get-active-policy",
    });
    const policy = parsePolicySnapshot(nativeResponse);
    if (!policy) throw new Error("Native host returned an invalid policy snapshot.");

    await chrome.storage.local.set({ [POLICY_SNAPSHOT_KEY]: policy });
    await applyPolicySnapshot(policy);
    console.info(`[FocusBlock] Policy synced (${policy.active ? policy.mode : "inactive"}).`);
    return true;
  } catch (error) {
    // Do not clear DNR rules or snapshot. Service may be restarting while policy remains active.
    console.warn("[FocusBlock] Policy sync unavailable; retained last policy snapshot.", error);
    return false;
  }
}

async function ensurePolicySyncAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(POLICY_SYNC_ALARM);
  if (!existing) {
    chrome.alarms.create(POLICY_SYNC_ALARM, { periodInMinutes: 0.5 });
  }
}

async function initializeWorker(): Promise<void> {
  await ensurePolicySyncAlarm();
  await restoreStoredPolicy();
  await refreshPolicyFromService();
}

function isServiceRequestMessage(value: unknown): value is ServiceRequestMessage {
  return (
    isRecord(value) &&
    value.type === "focusblock-service-request" &&
    isRecord(value.request) &&
    typeof value.request.cmd === "string" &&
    SERVICE_COMMANDS.has(value.request.cmd)
  );
}

function isIpcResponse(value: unknown): value is IpcResponse {
  return isRecord(value) && (value.status === "Ok" || value.status === "Err");
}

function isOkIpcResponse(value: unknown): value is IpcResponse {
  return isIpcResponse(value) && value.status === "Ok";
}

async function forwardServiceRequest(request: ServiceRequestMessage["request"]): Promise<IpcResponse> {
  const response = await chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, {
    type: "service-request",
    request,
  });
  if (!isIpcResponse(response)) {
    throw new Error("Native host returned an invalid service response.");
  }

  // State-changing commands take effect in the desktop service first, then DNR syncs.
  if (isOkIpcResponse(response)) {
    await refreshPolicyFromService();
  }
  return response;
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await chrome.storage.local.remove(LEGACY_STORAGE_KEYS);
    await initializeWorker();
  })().catch((error) => console.error("[FocusBlock] Install initialization failed.", error));
});

chrome.runtime.onStartup.addListener(() => {
  void initializeWorker().catch((error) => console.error("[FocusBlock] Startup initialization failed.", error));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== POLICY_SYNC_ALARM) return;
  void refreshPolicyFromService();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id && sender.id !== chrome.runtime.id) return;
  if (!isServiceRequestMessage(message)) return;

  void forwardServiceRequest(message.request)
    .then(sendResponse)
    .catch((error) => sendResponse({ status: "Err", message: error instanceof Error ? error.message : String(error) }));
  return true;
});

// Runs whenever Chrome creates this worker, including after idle termination.
void initializeWorker().catch((error) => console.error("[FocusBlock] Worker initialization failed.", error));
