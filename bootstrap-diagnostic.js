"use strict";

(function () {
  var BOOT_TIMEOUT_MS = 8000;
  var FALLBACK_ID = "boot-fallback";
  var OVERLAY_ID = "boot-error-overlay";
  var DETAILS_ID = "boot-error-details";
  var bootSucceeded = false;

  function toMessage(value) {
    if (value === null || value === undefined) {
      return "Unknown error";
    }

    if (value instanceof Error) {
      return value.name + ": " + value.message;
    }

    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (err) {
        return String(value);
      }
    }

    return String(value);
  }

  function getRoot() {
    return document.querySelector("app-root");
  }

  function getFallback() {
    return document.getElementById(FALLBACK_ID);
  }

  function hasAngularRendered() {
    var root = getRoot();
    var fallback = getFallback();

    if (!root || !root.firstElementChild) {
      return false;
    }

    if (!fallback) {
      return true;
    }

    if (root.children.length > 1) {
      return true;
    }

    return root.firstElementChild !== fallback;
  }

  function removeFallback() {
    var fallback = getFallback();
    if (fallback && fallback.parentNode) {
      fallback.parentNode.removeChild(fallback);
    }
  }

  function ensureOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      return overlay;
    }

    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.position = "fixed";
    overlay.style.left = "12px";
    overlay.style.right = "12px";
    overlay.style.bottom = "12px";
    overlay.style.zIndex = "2147483647";
    overlay.style.background = "#7f1d1d";
    overlay.style.color = "#ffffff";
    overlay.style.border = "1px solid #fecaca";
    overlay.style.borderRadius = "10px";
    overlay.style.padding = "12px";
    overlay.style.font = "13px/1.4 Consolas, Monaco, monospace";
    overlay.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)";
    overlay.innerHTML =
      "<div style=\"font:600 14px/1.3 Segoe UI,Tahoma,Arial,sans-serif;margin-bottom:8px;\">Demarrage bloque</div>" +
      "<pre id=\"" +
      DETAILS_ID +
      "\" style=\"margin:0;white-space:pre-wrap;max-height:220px;overflow:auto;\"></pre>";

    document.body.appendChild(overlay);
    return overlay;
  }

  function appendDetail(line) {
    ensureOverlay();
    var details = document.getElementById(DETAILS_ID);
    if (!details) {
      return;
    }

    if (details.textContent) {
      details.textContent += "\n";
    }
    details.textContent += line;
  }

  function reportIssue(source, message) {
    if (bootSucceeded) {
      return;
    }

    var line = "[" + new Date().toISOString() + "] " + source + " | " + message;
    appendDetail(line);

    if (window.console && typeof window.console.error === "function") {
      window.console.error("[boot-diagnostic]", source, message);
    }
  }

  function markBootSucceeded() {
    if (bootSucceeded) {
      return;
    }

    bootSucceeded = true;
    removeFallback();

    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function startRenderObserver() {
    var root = getRoot();
    if (!root || typeof MutationObserver === "undefined") {
      return;
    }

    var observer = new MutationObserver(function () {
      if (hasAngularRendered()) {
        markBootSucceeded();
        observer.disconnect();
      }
    });

    observer.observe(root, { childList: true });
  }

  function installGlobalListeners() {
    window.addEventListener("error", function (event) {
      var fileInfo = event.filename
        ? " (" + event.filename + ":" + event.lineno + ":" + event.colno + ")"
        : "";
      reportIssue("window.error", toMessage(event.message) + fileInfo);
    });

    window.addEventListener("unhandledrejection", function (event) {
      reportIssue("unhandledrejection", toMessage(event.reason));
    });

    window.addEventListener("securitypolicyviolation", function (event) {
      var blocked = event.blockedURI || "inline-resource";
      var details =
        event.violatedDirective + " blocked " + blocked + " (" + event.effectiveDirective + ")";
      reportIssue("csp", details);
    });
  }

  function scheduleBootTimeoutCheck() {
    window.setTimeout(function () {
      if (hasAngularRendered()) {
        markBootSucceeded();
        return;
      }

      reportIssue(
        "startup-timeout",
        "Aucun rendu Angular apres " + BOOT_TIMEOUT_MS + "ms. Ouvrez /__status pour verifier le deploiement."
      );
    }, BOOT_TIMEOUT_MS);
  }

  function init() {
    if (hasAngularRendered()) {
      markBootSucceeded();
    }

    startRenderObserver();
    scheduleBootTimeoutCheck();
  }

  installGlobalListeners();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
