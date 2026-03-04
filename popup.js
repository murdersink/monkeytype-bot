const KNOWN_MODES = ["time", "words", "quote", "zen"];
const PROFILE_VALUES = ["strict", "letters", "off"];

const DEFAULT_MODE_PROFILES = {
  time: "strict",
  words: "strict",
  quote: "strict",
  zen: "letters"
};

const DEFAULT_SETTINGS = {
  modeProfiles: { ...DEFAULT_MODE_PROFILES },
  hotkeyEnabled: true,
  autoRestartEnabled: false,
  autoRestartMinDelayMs: 900,
  autoRestartMaxDelayMs: 1800,
  autoRestartIdlePauseMs: 20000,
  autotyperEnabled: false,
  autotyperAvgWpm: 95,
  autotyperAccuracyPct: 97
};

const enableBtn = document.getElementById("enable");
const disableBtn = document.getElementById("disable");
const hotkeyEnabledInput = document.getElementById("hotkeyEnabled");
const autoRestartEnabledInput = document.getElementById("autoRestartEnabled");
const autoRestartMinDelayInput = document.getElementById("autoRestartMinDelay");
const autoRestartMaxDelayInput = document.getElementById("autoRestartMaxDelay");
const autoRestartIdlePauseInput = document.getElementById("autoRestartIdlePause");
const autotyperEnabledInput = document.getElementById("autotyperEnabled");
const autotyperAvgWpmInput = document.getElementById("autotyperAvgWpm");
const autotyperAccuracyPctInput = document.getElementById("autotyperAccuracyPct");
const statusEl = document.getElementById("status");

const profileInputs = {
  time: document.getElementById("profile-time"),
  words: document.getElementById("profile-words"),
  quote: document.getElementById("profile-quote"),
  zen: document.getElementById("profile-zen")
};

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeProfile(value) {
  return PROFILE_VALUES.includes(value) ? value : "strict";
}

function normalizeModeProfiles(input) {
  const normalized = { ...DEFAULT_MODE_PROFILES };
  if (!input || typeof input !== "object") {
    return normalized;
  }
  for (const mode of KNOWN_MODES) {
    normalized[mode] = normalizeProfile(input[mode]);
  }
  return normalized;
}

function readProfilesFromUi() {
  const output = {};
  for (const mode of KNOWN_MODES) {
    output[mode] = normalizeProfile(profileInputs[mode].value);
  }
  return output;
}

function applyProfilesToUi(modeProfiles) {
  for (const mode of KNOWN_MODES) {
    profileInputs[mode].value = normalizeProfile(modeProfiles[mode]);
  }
}

function readAutoRestartFromUi() {
  const minDelay = clampInt(autoRestartMinDelayInput.value, 100, 60000, 900);
  const maxDelayRaw = clampInt(autoRestartMaxDelayInput.value, 100, 60000, 1800);
  const maxDelay = Math.max(minDelay, maxDelayRaw);
  const idlePauseSec = clampInt(autoRestartIdlePauseInput.value, 1, 600, 20);

  return {
    autoRestartEnabled: autoRestartEnabledInput.checked,
    autoRestartMinDelayMs: minDelay,
    autoRestartMaxDelayMs: maxDelay,
    autoRestartIdlePauseMs: idlePauseSec * 1000
  };
}

function applyAutoRestartToUi(settings) {
  autoRestartEnabledInput.checked = settings.autoRestartEnabled === true;
  autoRestartMinDelayInput.value = clampInt(settings.autoRestartMinDelayMs, 100, 60000, 900);
  autoRestartMaxDelayInput.value = clampInt(settings.autoRestartMaxDelayMs, 100, 60000, 1800);
  autoRestartIdlePauseInput.value = clampInt(
    Math.round((settings.autoRestartIdlePauseMs || 20000) / 1000),
    1,
    600,
    20
  );
}

function readAutotyperFromUi() {
  return {
    autotyperEnabled: autotyperEnabledInput.checked,
    autotyperAvgWpm: clampInt(autotyperAvgWpmInput.value, 10, 400, 95),
    autotyperAccuracyPct: clampInt(autotyperAccuracyPctInput.value, 1, 100, 97)
  };
}

function applyAutotyperToUi(settings) {
  autotyperEnabledInput.checked = settings.autotyperEnabled === true;
  autotyperAvgWpmInput.value = clampInt(settings.autotyperAvgWpm, 10, 400, 95);
  autotyperAccuracyPctInput.value = clampInt(settings.autotyperAccuracyPct, 1, 100, 97);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function statusLabel(status) {
  const safeMode = KNOWN_MODES.includes(status.currentMode) ? status.currentMode : "time";
  const safeProfile = normalizeProfile(status.currentProfile);
  const correctorLabel = status.enabled
    ? `enabled (${safeMode}: ${safeProfile})`
    : `disabled (${safeMode}: ${safeProfile})`;
  const autoLabel = status.autoRestartEnabled ? "on" : "off";
  const autotyperWpm = clampInt(status.autotyperAvgWpm, 10, 400, 95);
  const autotyperAccuracy = clampInt(status.autotyperAccuracyPct, 1, 100, 97);
  const autotyperLabel = status.autotyperEnabled
    ? `on (${autotyperWpm} wpm, ${autotyperAccuracy}%)`
    : "off";
  const idleLabel = status.autoRestartWaitingForTyping ? ", idle-paused" : "";
  const adapter = status.debugSiteAdapter || "generic";
  const target = status.debugTypingTargetFound ? "target:yes" : "target:no";
  return `Status: ${correctorLabel} | Auto: ${autoLabel}${idleLabel} | Typing: ${autotyperLabel} | ${adapter}, ${target}`;
}

async function sendToTab(payload) {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    setStatus("Status: open a website tab (http/https)");
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, payload);
  } catch (_firstError) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["content.js"]
      });
    } catch (_injectError) {
      setStatus("Status: content script not reachable");
      return null;
    }

    try {
      return await chrome.tabs.sendMessage(tab.id, payload);
    } catch (_secondError) {
      setStatus("Status: content script not reachable");
      return null;
    }
  }
}

async function loadSettingsFromStorage() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  applyProfilesToUi(normalizeModeProfiles(stored.modeProfiles));
  hotkeyEnabledInput.checked = stored.hotkeyEnabled !== false;
  applyAutoRestartToUi(stored);
  applyAutotyperToUi(stored);
}

async function saveProfilesToStorage() {
  const modeProfiles = readProfilesFromUi();
  await chrome.storage.local.set({ modeProfiles });
}

async function saveHotkeyToStorage() {
  await chrome.storage.local.set({ hotkeyEnabled: hotkeyEnabledInput.checked });
}

async function saveAutoRestartToStorage() {
  const settings = readAutoRestartFromUi();
  applyAutoRestartToUi(settings);
  await chrome.storage.local.set(settings);
}

async function saveAutotyperToStorage() {
  const settings = readAutotyperFromUi();
  applyAutotyperToUi(settings);
  await chrome.storage.local.set(settings);
}

function syncFromStatus(status) {
  if (status.modeProfiles) {
    applyProfilesToUi(normalizeModeProfiles(status.modeProfiles));
  }
  if (typeof status.hotkeyEnabled === "boolean") {
    hotkeyEnabledInput.checked = status.hotkeyEnabled;
  }
  if (
    typeof status.autoRestartEnabled === "boolean" ||
    typeof status.autoRestartMinDelayMs === "number" ||
    typeof status.autoRestartMaxDelayMs === "number" ||
    typeof status.autoRestartIdlePauseMs === "number"
  ) {
    applyAutoRestartToUi(status);
  }
  if (
    typeof status.autotyperEnabled === "boolean" ||
    typeof status.autotyperAvgWpm === "number" ||
    typeof status.autotyperAccuracyPct === "number"
  ) {
    applyAutotyperToUi(status);
  }
}

async function refreshStatus() {
  const response = await sendToTab({ type: "GET_STATUS" });
  if (!response) {
    return;
  }

  syncFromStatus(response);
  setStatus(statusLabel(response));
}

enableBtn.addEventListener("click", async () => {
  const response = await sendToTab({ type: "ENABLE_CORRECTOR" });
  if (!response) {
    return;
  }
  syncFromStatus(response);
  setStatus(statusLabel(response));
});

disableBtn.addEventListener("click", async () => {
  const response = await sendToTab({ type: "DISABLE_CORRECTOR" });
  if (!response) {
    return;
  }
  syncFromStatus(response);
  setStatus(statusLabel(response));
});

for (const mode of KNOWN_MODES) {
  profileInputs[mode].addEventListener("change", async () => {
    await saveProfilesToStorage();
    await refreshStatus();
  });
}

hotkeyEnabledInput.addEventListener("change", async () => {
  await saveHotkeyToStorage();
  await refreshStatus();
});

autoRestartEnabledInput.addEventListener("change", async () => {
  await saveAutoRestartToStorage();
  await refreshStatus();
});

autoRestartMinDelayInput.addEventListener("change", async () => {
  await saveAutoRestartToStorage();
  await refreshStatus();
});

autoRestartMaxDelayInput.addEventListener("change", async () => {
  await saveAutoRestartToStorage();
  await refreshStatus();
});

autoRestartIdlePauseInput.addEventListener("change", async () => {
  await saveAutoRestartToStorage();
  await refreshStatus();
});

autotyperEnabledInput.addEventListener("change", async () => {
  await saveAutotyperToStorage();
  await refreshStatus();
});

autotyperAvgWpmInput.addEventListener("change", async () => {
  await saveAutotyperToStorage();
  await refreshStatus();
});

autotyperAccuracyPctInput.addEventListener("change", async () => {
  await saveAutotyperToStorage();
  await refreshStatus();
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettingsFromStorage();
  await refreshStatus();
});
