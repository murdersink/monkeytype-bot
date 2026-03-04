if (window.__typingSiteCorrectorLoaded) {
  // Already initialized for this frame.
} else {
window.__typingSiteCorrectorLoaded = true;

const KNOWN_MODES = ["time", "words", "quote", "zen"];
const PROFILE_VALUES = ["strict", "letters", "off"];
const HOTKEY_KEY = "e";
const AUTO_RESTART_POLL_INTERVAL_MS = 350;
const MONKEYTYPE_HOST_RE = /(^|\.)monkeytype\.com$/i;
const TYPERACER_HOST_RE = /(^|\.)typeracer\.com$/i;
const NITROTYPE_HOST_RE = /(^|\.)nitrotype\.com$/i;
const TYPERACER_TYPING_TARGET_SELECTORS = [
  ".gameView .inputPanel .txtInput",
  ".inputPanel .txtInput",
  "input.txtInput"
];
const TYPERACER_PROMPT_SELECTORS = [
  ".gameView .inputPanel .prompt",
  ".gameView .inputPanel .hideableWords",
  ".gameView .inputPanel .nonHideableWords",
  ".inputPanel .prompt",
  ".inputPanel .hideableWords",
  ".inputPanel .nonHideableWords",
  ".gameView .inputPanel .logographicWords"
];
const NITROTYPE_TYPING_TARGET_SELECTORS = [
  "#raceContainer input[type='text']",
  "#race-track input[type='text']",
  ".racev3 input[type='text']",
  ".racev3 input",
  "input[class*='race']",
  "input[class*='typing']"
];
const NITROTYPE_PROMPT_SELECTORS = [
  "#raceContainer .dash-copy",
  ".dash-copy",
  ".dash-copyText",
  ".dash-word",
  ".dashWord",
  ".racev3-word",
  "[data-testid='raceText']",
  "[class*='dashCopy']"
];
const COMMON_TYPING_TARGET_SELECTORS = [
  "#wordsInput",
  "#inputfield",
  "#inputText",
  "#typing-input",
  ".typing-input input",
  "input[type='text']",
  "textarea",
  "[contenteditable='true']"
];
const COMMON_ACTIVE_WORD_SELECTORS = [
  "#words .word.active",
  ".word.active",
  ".word.current",
  ".active.word",
  ".current-word",
  ".word.currentWord",
  ".word--active",
  ".typing-word.active",
  ".token.active",
  "#row1 span.highlight"
];
const COMMON_CURRENT_CHAR_SELECTORS = [
  "#words .word.active .letter.current",
  ".word.active .letter.current",
  ".letter.current",
  ".char.current",
  ".character.current",
  ".current .letter",
  ".current .char",
  ".active-letter",
  ".typing-char.active",
  ".cursor .char"
];
const KEY_CODE_BY_CHAR = {
  " ": "Space",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  ";": "Semicolon",
  "'": "Quote",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  "-": "Minus",
  "=": "Equal",
  "`": "Backquote"
};
const AUTOTYPER_MIN_ALLOWED_WPM = 10;
const AUTOTYPER_MAX_ALLOWED_WPM = 400;
const AUTOTYPER_DEFAULT_WPM = 95;
const AUTOTYPER_DEFAULT_ACCURACY = 97;
const AUTOTYPER_DELAY_JITTER_RATIO = 0.3;
const AUTOTYPER_MIN_DELAY_MS = 20;
const AUTOTYPER_MAX_DELAY_MS = 2000;
const AUTOTYPER_WRONG_CHAR_POOL = "etaoinshrdlcumwfgypbvkjxqz0123456789,.;:'\"!?-";

const DEFAULT_MODE_PROFILES = {
  time: "strict",
  words: "strict",
  quote: "strict",
  zen: "letters"
};

const DEFAULT_SETTINGS = {
  correctorEnabled: false,
  autotyperEnabled: false,
  autotyperAvgWpm: AUTOTYPER_DEFAULT_WPM,
  autotyperAccuracyPct: AUTOTYPER_DEFAULT_ACCURACY,
  hotkeyEnabled: true,
  modeProfiles: { ...DEFAULT_MODE_PROFILES },
  autoRestartEnabled: false,
  autoRestartMinDelayMs: 900,
  autoRestartMaxDelayMs: 1800,
  autoRestartIdlePauseMs: 20000
};

const STATE = {
  enabled: false,
  autotyperEnabled: false,
  autotyperAvgWpm: AUTOTYPER_DEFAULT_WPM,
  autotyperAccuracyPct: AUTOTYPER_DEFAULT_ACCURACY,
  injecting: false,
  hotkeyEnabled: true,
  modeProfiles: { ...DEFAULT_MODE_PROFILES },
  autoRestartEnabled: false,
  autoRestartMinDelayMs: 900,
  autoRestartMaxDelayMs: 1800,
  autoRestartIdlePauseMs: 20000,
  autotyperTimer: null,
  lastRealTypeTs: 0,
  restartTimer: null,
  resultVisible: false,
  autoRestartPollTimer: null,
  nitroCanvasPrompt: "",
  nitroCanvasPromptTs: 0
};

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function isKnownMode(mode) {
  return KNOWN_MODES.includes(mode);
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

function normalizeAutoRestartSettings(input) {
  const minDelay = clampInt(input.autoRestartMinDelayMs, 100, 60000, 900);
  const maxDelayRaw = clampInt(input.autoRestartMaxDelayMs, 100, 60000, 1800);
  const maxDelay = Math.max(minDelay, maxDelayRaw);
  const idlePause = clampInt(input.autoRestartIdlePauseMs, 1000, 600000, 20000);

  return {
    autoRestartEnabled: input.autoRestartEnabled === true,
    autoRestartMinDelayMs: minDelay,
    autoRestartMaxDelayMs: maxDelay,
    autoRestartIdlePauseMs: idlePause
  };
}

function normalizeAutotyperSettings(input) {
  const avgWpm = clampInt(
    input.autotyperAvgWpm,
    AUTOTYPER_MIN_ALLOWED_WPM,
    AUTOTYPER_MAX_ALLOWED_WPM,
    AUTOTYPER_DEFAULT_WPM
  );
  const accuracyPct = clampInt(input.autotyperAccuracyPct, 1, 100, AUTOTYPER_DEFAULT_ACCURACY);

  return {
    autotyperEnabled: input.autotyperEnabled === true,
    autotyperAvgWpm: avgWpm,
    autotyperAccuracyPct: accuracyPct
  };
}

function isMonkeytypeSite() {
  return MONKEYTYPE_HOST_RE.test(window.location.hostname);
}

function isTyperacerSite() {
  return TYPERACER_HOST_RE.test(window.location.hostname);
}

function isNitrotypeSite() {
  return NITROTYPE_HOST_RE.test(window.location.hostname);
}

function isEditableTarget(node) {
  if (!node || !(node instanceof HTMLElement)) {
    return false;
  }
  if (node instanceof HTMLInputElement) {
    return node.type === "text" && !node.readOnly && !node.disabled;
  }
  if (node instanceof HTMLTextAreaElement) {
    return !node.readOnly && !node.disabled;
  }
  return node.isContentEditable;
}

function getTypingTarget() {
  const activeElement = document.activeElement;
  if (isEditableTarget(activeElement)) {
    return activeElement;
  }

  const selectors = [];
  if (isTyperacerSite()) {
    selectors.push(...TYPERACER_TYPING_TARGET_SELECTORS);
  }
  if (isNitrotypeSite()) {
    selectors.push(...NITROTYPE_TYPING_TARGET_SELECTORS);
  }
  selectors.push(...COMMON_TYPING_TARGET_SELECTORS);

  for (const selector of selectors) {
    const nodeList = document.querySelectorAll(selector);
    for (const node of nodeList) {
      if (!isEditableTarget(node)) {
        continue;
      }
      if (!isElementVisible(node)) {
        continue;
      }
      return node;
    }
  }

  return null;
}

function focusTypingTarget() {
  const target = getTypingTarget();
  if (!target) {
    return;
  }
  if (typeof target.focus === "function") {
    target.focus({ preventScroll: true });
  }
  if (typeof target.click === "function") {
    target.click();
  }
}

function isTypingTarget(node) {
  const target = getTypingTarget();
  if (!target) {
    return false;
  }
  if (node === target) {
    return true;
  }
  return Boolean(node instanceof Node && target.contains(node));
}

function getCurrentMode() {
  const modeButton = document.querySelector("#testConfig .mode .textButton.active[mode]");
  const mode = modeButton?.getAttribute("mode")?.toLowerCase() || "";
  if (isKnownMode(mode)) {
    return mode;
  }
  return "time";
}

function getProfileForMode(mode) {
  const normalizedMode = isKnownMode(mode) ? mode : "time";
  return normalizeProfile(STATE.modeProfiles[normalizedMode]);
}

function getActiveWordElement() {
  for (const selector of COMMON_ACTIVE_WORD_SELECTORS) {
    const nodes = document.querySelectorAll(selector);
    for (const node of nodes) {
      if (node instanceof HTMLElement && isElementVisible(node)) {
        return node;
      }
    }
  }
  return null;
}

function extractWordText(wordElement) {
  if (!wordElement) {
    return "";
  }

  const letters = wordElement.querySelectorAll(".letter, .char, [data-char]");
  if (letters.length > 0) {
    return Array.from(letters)
      .map((node) => node.getAttribute("data-char") || node.textContent || "")
      .join("");
  }
  return (wordElement.textContent || "").replace(/\s+/g, "");
}

function getTypedTokenFromInput(target) {
  if (!target) {
    return "";
  }

  let source = "";
  if (typeof target.value === "string") {
    source = target.value;
  } else if (target instanceof HTMLElement && target.isContentEditable) {
    source = target.innerText || target.textContent || "";
  }

  if (!source) {
    return "";
  }

  const parts = source.split(/\s+/);
  return parts[parts.length - 1] || "";
}

function getTypedLengthFromInput(target) {
  if (!target) {
    return 0;
  }
  if (typeof target.value === "string") {
    return target.value.length;
  }
  if (target instanceof HTMLElement && target.isContentEditable) {
    return (target.innerText || target.textContent || "").length;
  }
  return 0;
}

function normalizeCandidateChar(text) {
  if (typeof text !== "string") {
    return null;
  }
  const normalized = text.replace(/\s+/g, " ");
  if (normalized.length === 1) {
    return normalized;
  }
  return null;
}

function getExpectedCharFromCurrentMarker() {
  for (const selector of COMMON_CURRENT_CHAR_SELECTORS) {
    const nodes = document.querySelectorAll(selector);
    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || !isElementVisible(node)) {
        continue;
      }
      const dataChar = normalizeCandidateChar(node.getAttribute("data-char"));
      if (dataChar) {
        return dataChar;
      }
      const textChar = normalizeCandidateChar(node.textContent || "");
      if (textChar) {
        return textChar;
      }
    }
  }
  return null;
}

function getLongestVisibleText(selectors) {
  let best = "";
  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);
    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || !isElementVisible(node)) {
        continue;
      }
      const text = (node.innerText || node.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > best.length) {
        best = text;
      }
    }
  }
  return best;
}

function getTyperacerExpectedCharacter(target) {
  if (!isTyperacerSite()) {
    return null;
  }

  const prompt = getLongestVisibleText(TYPERACER_PROMPT_SELECTORS);
  if (!prompt) {
    return null;
  }

  const typedLength = getTypedLengthFromInput(target);
  if (typedLength < prompt.length) {
    return prompt.charAt(typedLength);
  }
  return " ";
}

function shouldUseNitroCanvasText(text) {
  if (!text) {
    return false;
  }
  if (text.length < 12) {
    return false;
  }
  if (!/[A-Za-z]/.test(text)) {
    return false;
  }
  if (/wpm|nitro type|accuracy|place|speed/i.test(text)) {
    return false;
  }
  return /\s/.test(text);
}

function rememberNitroCanvasText(text) {
  if (!isNitrotypeSite() || typeof text !== "string") {
    return;
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!shouldUseNitroCanvasText(normalized)) {
    return;
  }

  const isBetter = normalized.length > STATE.nitroCanvasPrompt.length;
  const isStale = Date.now() - STATE.nitroCanvasPromptTs > 2000;
  if (isBetter || isStale) {
    STATE.nitroCanvasPrompt = normalized;
    STATE.nitroCanvasPromptTs = Date.now();
  }
}

function initNitroCanvasCapture() {
  if (!isNitrotypeSite()) {
    return;
  }
  const proto = window.CanvasRenderingContext2D?.prototype;
  if (!proto || proto.__typingCorrectorHooked) {
    return;
  }

  const originalFillText = proto.fillText;
  proto.fillText = function patchedFillText(text, ...rest) {
    rememberNitroCanvasText(typeof text === "string" ? text : "");
    return originalFillText.call(this, text, ...rest);
  };

  const originalStrokeText = proto.strokeText;
  if (typeof originalStrokeText === "function") {
    proto.strokeText = function patchedStrokeText(text, ...rest) {
      rememberNitroCanvasText(typeof text === "string" ? text : "");
      return originalStrokeText.call(this, text, ...rest);
    };
  }

  proto.__typingCorrectorHooked = true;
}

function getNitrotypeExpectedCharacter(target) {
  if (!isNitrotypeSite()) {
    return null;
  }

  let prompt = getLongestVisibleText(NITROTYPE_PROMPT_SELECTORS);
  if (!prompt && STATE.nitroCanvasPrompt) {
    prompt = STATE.nitroCanvasPrompt;
  }
  if (!prompt) {
    return null;
  }

  const typedLength = getTypedLengthFromInput(target);
  if (typedLength < prompt.length) {
    return prompt.charAt(typedLength);
  }
  return " ";
}

function getExpectedCharacter(target) {
  const typeracerExpected = getTyperacerExpectedCharacter(target);
  if (typeracerExpected) {
    return typeracerExpected;
  }

  const nitroExpected = getNitrotypeExpectedCharacter(target);
  if (nitroExpected) {
    return nitroExpected;
  }

  const currentMarkedChar = getExpectedCharFromCurrentMarker();
  if (currentMarkedChar) {
    return currentMarkedChar;
  }

  const activeWord = getActiveWordElement();
  if (!activeWord) {
    return null;
  }

  const word = extractWordText(activeWord);
  if (!word) {
    return " ";
  }

  const typedToken = getTypedTokenFromInput(target);
  const typedCount = typedToken.length;
  if (typedCount < word.length) {
    return word.charAt(typedCount);
  }
  return " ";
}

function dispatchInputEvent(target, type, char) {
  const inputType = char === "\n" ? "insertLineBreak" : "insertText";
  const eventInit = {
    data: char,
    inputType,
    bubbles: true,
    cancelable: type === "beforeinput",
    composed: true
  };

  try {
    return target.dispatchEvent(new InputEvent(type, eventInit));
  } catch (_error) {
    return target.dispatchEvent(
      new Event(type, {
        bubbles: true,
        cancelable: type === "beforeinput"
      })
    );
  }
}

function codeForKey(key) {
  if (!key) {
    return "";
  }
  if (/^[a-zA-Z]$/.test(key)) {
    return `Key${key.toUpperCase()}`;
  }
  if (/^\d$/.test(key)) {
    return `Digit${key}`;
  }
  return KEY_CODE_BY_CHAR[key] || "";
}

function dispatchKeyboardEvent(target, type, key) {
  const code = codeForKey(key);
  const keyCode = key === " " ? 32 : (key && key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
  const charCode = type === "keypress" ? keyCode : 0;

  let event;
  try {
    event = new KeyboardEvent(type, {
      key,
      code,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    Object.defineProperty(event, "keyCode", { get: () => keyCode });
    Object.defineProperty(event, "which", { get: () => keyCode });
    Object.defineProperty(event, "charCode", { get: () => charCode });
  } catch (_error) {
    event = new Event(type, { bubbles: true, cancelable: true });
  }

  target.dispatchEvent(event);

  if (window.jQuery && typeof window.jQuery.Event === "function") {
    const jqEvent = window.jQuery.Event(type);
    jqEvent.key = key;
    jqEvent.which = keyCode;
    jqEvent.keyCode = keyCode;
    jqEvent.charCode = charCode;
    window.jQuery(target).trigger(jqEvent);
  }
}

function normalizeTypedKeyFromKeyboard(event) {
  if (!event || typeof event.key !== "string") {
    return null;
  }
  if (event.key === "Spacebar" || event.key === " ") {
    return " ";
  }
  if (event.key.length === 1) {
    return event.key;
  }
  return null;
}

function injectCharacter(char, options = {}) {
  const target = options.target && isEditableTarget(options.target)
    ? options.target
    : getTypingTarget();
  if (!target) {
    return;
  }

  STATE.injecting = true;
  try {
    if (options.emitKeyboardEvents) {
      dispatchKeyboardEvent(target, "keydown", char);
      dispatchKeyboardEvent(target, "keypress", char);
    }

    const accepted = dispatchInputEvent(target, "beforeinput", char);
    if (!accepted) {
      return;
    }

    if (typeof target.value === "string") {
      target.value = `${target.value}${char}`;
    } else if (target instanceof HTMLElement && target.isContentEditable) {
      if (typeof document.execCommand === "function") {
        const inserted = document.execCommand("insertText", false, char);
        if (!inserted) {
          target.textContent = `${target.textContent || ""}${char}`;
        }
      } else {
        target.textContent = `${target.textContent || ""}${char}`;
      }
    }

    dispatchInputEvent(target, "input", char);

    if (options.emitKeyboardEvents) {
      dispatchKeyboardEvent(target, "keyup", char);
    }
  } finally {
    STATE.injecting = false;
  }
}

function getInputChar(event) {
  if (event.inputType === "insertLineBreak") {
    return "\n";
  }
  if (event.inputType !== "insertText") {
    return null;
  }
  return typeof event.data === "string" ? event.data : null;
}

function shouldCorrectForProfile(profile, typedChar, expectedChar) {
  if (profile === "off") {
    return false;
  }
  if (profile === "letters") {
    return /^[A-Za-z]$/.test(typedChar) && /^[A-Za-z]$/.test(expectedChar);
  }
  return true;
}

function isTypingInputType(inputType) {
  return [
    "insertText",
    "insertCompositionText",
    "insertFromComposition",
    "insertLineBreak",
    "deleteContentBackward",
    "deleteWordBackward"
  ].includes(inputType);
}

function isTypingKeyEvent(event) {
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return false;
  }
  if (event.key.length === 1) {
    return true;
  }
  return ["Backspace", "Spacebar", "Enter", " "].includes(event.key);
}

function markRealTypingActivity() {
  STATE.lastRealTypeTs = Date.now();
}

function handleBeforeInputCapture(event) {
  const typingTarget = getTypingTarget();
  if (!typingTarget) {
    return;
  }
  if (!isTypingTarget(event.target)) {
    return;
  }

  if (event.isTrusted && isTypingInputType(event.inputType)) {
    markRealTypingActivity();
  }

  if (!STATE.enabled || STATE.injecting || event.defaultPrevented) {
    return;
  }

  const typed = getInputChar(event);
  if (!typed || typed.length !== 1) {
    return;
  }

  const mode = getCurrentMode();
  const profile = getProfileForMode(mode);
  if (profile === "off") {
    return;
  }

  const expected = getExpectedCharacter(typingTarget);
  if (!expected || typed === expected) {
    return;
  }
  if (!shouldCorrectForProfile(profile, typed, expected)) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  injectCharacter(expected, {
    target: typingTarget
  });
}

function setEnabled(enabled, persist = true) {
  STATE.enabled = Boolean(enabled);
  if (STATE.enabled) {
    focusTypingTarget();
  }
  if (persist) {
    chrome.storage.local.set({ correctorEnabled: STATE.enabled });
  }
}

function setAutotyperEnabled(enabled, persist = true) {
  STATE.autotyperEnabled = Boolean(enabled);
  if (persist) {
    chrome.storage.local.set({ autotyperEnabled: STATE.autotyperEnabled });
  }
  if (STATE.autotyperEnabled) {
    focusTypingTarget();
  }
  evaluateResultScreenState();
}

function isToggleHotkey(event) {
  if (!STATE.hotkeyEnabled) {
    return false;
  }
  if (event.defaultPrevented || event.isComposing) {
    return false;
  }
  if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) {
    return false;
  }
  return typeof event.key === "string" && event.key.toLowerCase() === HOTKEY_KEY;
}

function clearAutotyperTimer() {
  if (!STATE.autotyperTimer) {
    return;
  }
  clearTimeout(STATE.autotyperTimer);
  STATE.autotyperTimer = null;
}

function clearRestartTimer() {
  if (!STATE.restartTimer) {
    return;
  }
  clearTimeout(STATE.restartTimer);
  STATE.restartTimer = null;
}

function hasRecentHumanTyping() {
  if (STATE.autotyperEnabled) {
    return true;
  }
  if (STATE.autoRestartIdlePauseMs <= 0) {
    return true;
  }
  if (!STATE.lastRealTypeTs) {
    return false;
  }
  return Date.now() - STATE.lastRealTypeTs <= STATE.autoRestartIdlePauseMs;
}

function isElementVisible(element) {
  if (!element) {
    return false;
  }
  if (element.classList.contains("hidden")) {
    return false;
  }
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  return element.getClientRects().length > 0;
}

function isResultScreenVisible() {
  if (!isMonkeytypeSite()) {
    return false;
  }
  const result = document.querySelector(".pageTest #result, #result");
  return isElementVisible(result);
}

function clickFirstVisibleButton(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element || !(element instanceof HTMLElement)) {
      continue;
    }
    if (element.hasAttribute("disabled")) {
      continue;
    }
    if (!isElementVisible(element)) {
      continue;
    }
    element.click();
    return true;
  }
  return false;
}

function triggerNextTestRestart() {
  if (!isMonkeytypeSite()) {
    return false;
  }
  return clickFirstVisibleButton([
    "#nextTestButton",
    ".pageTest #nextTestButton",
    "#restartTestButton",
    ".pageTest #restartTestButton",
    "#restartTestButtonWithSameWordset",
    ".pageTest #restartTestButtonWithSameWordset"
  ]);
}

function randomRestartDelayMs() {
  const min = STATE.autoRestartMinDelayMs;
  const max = STATE.autoRestartMaxDelayMs;
  if (max <= min) {
    return min;
  }
  return min + Math.round(Math.random() * (max - min));
}

function randomAutotyperDelayMs() {
  const safeWpm = clampInt(
    STATE.autotyperAvgWpm,
    AUTOTYPER_MIN_ALLOWED_WPM,
    AUTOTYPER_MAX_ALLOWED_WPM,
    AUTOTYPER_DEFAULT_WPM
  );
  const baseDelayMs = 12000 / safeWpm;
  const jitter = baseDelayMs * AUTOTYPER_DELAY_JITTER_RATIO;
  const randomizedDelay = baseDelayMs + ((Math.random() * 2 - 1) * jitter);
  return clampInt(randomizedDelay, AUTOTYPER_MIN_DELAY_MS, AUTOTYPER_MAX_DELAY_MS, baseDelayMs);
}

function getWrongAutotyperCharacter(expectedChar) {
  const expectedLower = (expectedChar || "").toLowerCase();

  for (let i = 0; i < 10; i += 1) {
    const index = Math.floor(Math.random() * AUTOTYPER_WRONG_CHAR_POOL.length);
    const candidate = AUTOTYPER_WRONG_CHAR_POOL.charAt(index);
    if (!candidate) {
      continue;
    }
    if (candidate.toLowerCase() !== expectedLower) {
      return candidate;
    }
  }

  return expectedLower === "x" ? "z" : "x";
}

function pickAutotyperCharacter(expectedChar) {
  const accuracyRoll = Math.random() * 100;
  if (accuracyRoll < STATE.autotyperAccuracyPct) {
    return expectedChar;
  }
  return getWrongAutotyperCharacter(expectedChar);
}

function scheduleAutotyperTick(delayOverrideMs) {
  if (STATE.autotyperTimer) {
    return;
  }
  if (!isMonkeytypeSite()) {
    return;
  }
  if (!STATE.autotyperEnabled || STATE.resultVisible) {
    return;
  }

  const delayMs = typeof delayOverrideMs === "number"
    ? clampInt(delayOverrideMs, 20, 5000, AUTOTYPER_MIN_DELAY_MS)
    : randomAutotyperDelayMs();

  STATE.autotyperTimer = setTimeout(() => {
    STATE.autotyperTimer = null;
    if (!STATE.autotyperEnabled || STATE.resultVisible) {
      return;
    }

    const target = getTypingTarget();
    if (!target) {
      scheduleAutotyperTick(300);
      return;
    }

    if (document.activeElement !== target) {
      focusTypingTarget();
    }

    const expected = getExpectedCharacter(target);
    if (!expected || expected.length !== 1) {
      scheduleAutotyperTick(120);
      return;
    }

    injectCharacter(pickAutotyperCharacter(expected));
    scheduleAutotyperTick();
  }, delayMs);
}

function scheduleAutoRestart(delayOverrideMs) {
  if (STATE.restartTimer) {
    return;
  }
  if (!isMonkeytypeSite()) {
    return;
  }
  if (!STATE.autoRestartEnabled || !STATE.resultVisible) {
    return;
  }
  if (!hasRecentHumanTyping()) {
    return;
  }

  const delayMs = typeof delayOverrideMs === "number"
    ? clampInt(delayOverrideMs, 100, 60000, STATE.autoRestartMinDelayMs)
    : randomRestartDelayMs();

  STATE.restartTimer = setTimeout(() => {
    STATE.restartTimer = null;
    if (!STATE.autoRestartEnabled || !STATE.resultVisible) {
      return;
    }
    if (!hasRecentHumanTyping()) {
      return;
    }

    const restarted = triggerNextTestRestart();
    if (!restarted && STATE.resultVisible && STATE.autoRestartEnabled) {
      scheduleAutoRestart(500);
    }
  }, delayMs);
}

function evaluateResultScreenState() {
  const visible = isResultScreenVisible();
  STATE.resultVisible = visible;

  if (visible) {
    clearAutotyperTimer();
    if (STATE.autoRestartEnabled) {
      scheduleAutoRestart();
    } else {
      clearRestartTimer();
    }
    return;
  }

  clearRestartTimer();
  if (STATE.autotyperEnabled) {
    scheduleAutotyperTick();
  } else {
    clearAutotyperTimer();
  }
}

function startAutoRestartPoll() {
  if (STATE.autoRestartPollTimer) {
    return;
  }
  STATE.autoRestartPollTimer = setInterval(
    evaluateResultScreenState,
    AUTO_RESTART_POLL_INTERVAL_MS
  );
}

function initSiteIntegrations() {
  initNitroCanvasCapture();
}

function applySettings(settings) {
  STATE.modeProfiles = normalizeModeProfiles(settings.modeProfiles);
  STATE.hotkeyEnabled = settings.hotkeyEnabled !== false;
  STATE.enabled = Boolean(settings.correctorEnabled);

  const autotyperSettings = normalizeAutotyperSettings(settings);
  STATE.autotyperEnabled = autotyperSettings.autotyperEnabled;
  STATE.autotyperAvgWpm = autotyperSettings.autotyperAvgWpm;
  STATE.autotyperAccuracyPct = autotyperSettings.autotyperAccuracyPct;

  const autoRestartSettings = normalizeAutoRestartSettings(settings);
  STATE.autoRestartEnabled = autoRestartSettings.autoRestartEnabled;
  STATE.autoRestartMinDelayMs = autoRestartSettings.autoRestartMinDelayMs;
  STATE.autoRestartMaxDelayMs = autoRestartSettings.autoRestartMaxDelayMs;
  STATE.autoRestartIdlePauseMs = autoRestartSettings.autoRestartIdlePauseMs;

  if (STATE.enabled || STATE.autotyperEnabled) {
    focusTypingTarget();
  }
  evaluateResultScreenState();
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  applySettings(stored);
}

function snapshot() {
  const currentMode = getCurrentMode();
  const target = getTypingTarget();
  const expected = target ? getExpectedCharacter(target) : null;
  let siteAdapter = "generic";
  if (isMonkeytypeSite()) {
    siteAdapter = "monkeytype";
  } else if (isTyperacerSite()) {
    siteAdapter = "typeracer";
  } else if (isNitrotypeSite()) {
    siteAdapter = "nitrotype";
  }
  return {
    enabled: STATE.enabled,
    autotyperEnabled: STATE.autotyperEnabled,
    autotyperAvgWpm: STATE.autotyperAvgWpm,
    autotyperAccuracyPct: STATE.autotyperAccuracyPct,
    hotkeyEnabled: STATE.hotkeyEnabled,
    currentMode,
    currentProfile: getProfileForMode(currentMode),
    modeProfiles: { ...STATE.modeProfiles },
    autoRestartEnabled: STATE.autoRestartEnabled,
    autoRestartMinDelayMs: STATE.autoRestartMinDelayMs,
    autoRestartMaxDelayMs: STATE.autoRestartMaxDelayMs,
    autoRestartIdlePauseMs: STATE.autoRestartIdlePauseMs,
    autoRestartWaitingForTyping: !hasRecentHumanTyping(),
    debugSiteAdapter: siteAdapter,
    debugTypingTargetFound: Boolean(target),
    debugExpectedChar: typeof expected === "string" ? expected : null
  };
}

function handleKeydownCapture(event) {
  if (isToggleHotkey(event)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setEnabled(!STATE.enabled, true);
    return;
  }

  if (!STATE.enabled || STATE.injecting || event.defaultPrevented) {
    if (event.isTrusted && isTypingTarget(event.target) && isTypingKeyEvent(event)) {
      markRealTypingActivity();
    }
    return;
  }

  const target = getTypingTarget();
  const shouldUseKeyboardFallback = isTyperacerSite() || isNitrotypeSite();
  if (shouldUseKeyboardFallback && target) {
    const typed = normalizeTypedKeyFromKeyboard(event);
    if (typed) {
      const mode = getCurrentMode();
      const profile = getProfileForMode(mode);
      const expected = getExpectedCharacter(target);

      if (
        profile !== "off" &&
        expected &&
        typed !== expected &&
        shouldCorrectForProfile(profile, typed, expected)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        injectCharacter(expected, {
          target,
          emitKeyboardEvents: true
        });
        return;
      }
    }
  }

  if (event.isTrusted && isTypingTarget(event.target) && isTypingKeyEvent(event)) {
    markRealTypingActivity();
  }
}

document.addEventListener("beforeinput", handleBeforeInputCapture, true);
document.addEventListener("keydown", handleKeydownCapture, true);
initSiteIntegrations();
startAutoRestartPoll();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes.modeProfiles) {
    STATE.modeProfiles = normalizeModeProfiles(changes.modeProfiles.newValue);
  }
  if (changes.hotkeyEnabled) {
    STATE.hotkeyEnabled = changes.hotkeyEnabled.newValue !== false;
  }
  if (changes.correctorEnabled) {
    STATE.enabled = Boolean(changes.correctorEnabled.newValue);
    if (STATE.enabled) {
      focusTypingTarget();
    }
  }
  if (changes.autotyperEnabled || changes.autotyperAvgWpm || changes.autotyperAccuracyPct) {
    const newSettings = normalizeAutotyperSettings({
      autotyperEnabled: changes.autotyperEnabled ? changes.autotyperEnabled.newValue : STATE.autotyperEnabled,
      autotyperAvgWpm: changes.autotyperAvgWpm ? changes.autotyperAvgWpm.newValue : STATE.autotyperAvgWpm,
      autotyperAccuracyPct: changes.autotyperAccuracyPct ? changes.autotyperAccuracyPct.newValue : STATE.autotyperAccuracyPct
    });

    STATE.autotyperEnabled = newSettings.autotyperEnabled;
    STATE.autotyperAvgWpm = newSettings.autotyperAvgWpm;
    STATE.autotyperAccuracyPct = newSettings.autotyperAccuracyPct;

    if (STATE.autotyperEnabled) {
      focusTypingTarget();
    }

    clearAutotyperTimer();
    evaluateResultScreenState();
  }

  if (changes.autoRestartEnabled || changes.autoRestartMinDelayMs || changes.autoRestartMaxDelayMs || changes.autoRestartIdlePauseMs) {
    const newSettings = normalizeAutoRestartSettings({
      autoRestartEnabled: changes.autoRestartEnabled ? changes.autoRestartEnabled.newValue : STATE.autoRestartEnabled,
      autoRestartMinDelayMs: changes.autoRestartMinDelayMs ? changes.autoRestartMinDelayMs.newValue : STATE.autoRestartMinDelayMs,
      autoRestartMaxDelayMs: changes.autoRestartMaxDelayMs ? changes.autoRestartMaxDelayMs.newValue : STATE.autoRestartMaxDelayMs,
      autoRestartIdlePauseMs: changes.autoRestartIdlePauseMs ? changes.autoRestartIdlePauseMs.newValue : STATE.autoRestartIdlePauseMs
    });

    STATE.autoRestartEnabled = newSettings.autoRestartEnabled;
    STATE.autoRestartMinDelayMs = newSettings.autoRestartMinDelayMs;
    STATE.autoRestartMaxDelayMs = newSettings.autoRestartMaxDelayMs;
    STATE.autoRestartIdlePauseMs = newSettings.autoRestartIdlePauseMs;

    if (!STATE.autoRestartEnabled) {
      clearRestartTimer();
    } else {
      evaluateResultScreenState();
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    sendResponse(snapshot());
    return;
  }

  if (message.type === "ENABLE_CORRECTOR") {
    setEnabled(true, true);
    sendResponse(snapshot());
    return;
  }

  if (message.type === "DISABLE_CORRECTOR") {
    setEnabled(false, true);
    sendResponse(snapshot());
    return;
  }

  if (message.type === "START_AUTOTYPE") {
    setAutotyperEnabled(true, true);
    sendResponse(snapshot());
    return;
  }

  if (message.type === "STOP_AUTOTYPE") {
    setAutotyperEnabled(false, true);
    sendResponse(snapshot());
    return;
  }

  if (message.type === "TOGGLE_CORRECTOR") {
    setEnabled(!STATE.enabled, true);
    sendResponse(snapshot());
    return;
  }

  if (message.type === "TOGGLE_AUTOTYPE") {
    setAutotyperEnabled(!STATE.autotyperEnabled, true);
    sendResponse(snapshot());
    return;
  }

  if (message.type === "GET_STATUS") {
    sendResponse(snapshot());
    return;
  }

  sendResponse(snapshot());
});

void loadSettings();
}
