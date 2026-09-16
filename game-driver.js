/*
 * game-driver.js — neutral offline driver.
 * Replaces the portal SDK with a faithful local implementation of the
 * exact surface the game calls. No network, no analytics, no ads.
 * Ad callbacks ALWAYS resolve so the game never freezes on a break.
 */
(function () {
  'use strict';

  // ---------- storage: synchronous, plain string values ----------
  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  // ---------- audio state (mirrors what the portal would report) ----------
  var soundEnabled = true;
  try {
    var saved = window.localStorage.getItem('soundState');
    if (saved !== null) soundEnabled = (saved === 'true');
  } catch (e) { /* default true */ }

  var audioListeners = [];
  function notifyAudio() {
    for (var i = 0; i < audioListeners.length; i++) {
      try { audioListeners[i](soundEnabled); } catch (e) { /* listener error ignored */ }
    }
  }

  var GameSnacks = {
    audio: {
      subscribe: function (fn) {
        if (typeof fn === 'function') audioListeners.push(fn);
        // Immediately inform of current state (portal semantics).
        try { fn(soundEnabled); } catch (e) { /* ignored */ }
      },
      isEnabled: function () { return soundEnabled; },
    },
    game: {
      ready: function () { /* lifecycle: game ready to be shown */ },
      firstFrameReady: function () { /* lifecycle: first frame rendered */ },
      onPause: function (fn) { driver.onPauseCallback = fn; },
      onResume: function (fn) { driver.onResumeCallback = fn; },
      levelComplete: function (level) { /* lifecycle: level completed */ },
      gameOver: function () { /* lifecycle: game over */ },
    },
    score: {
      update: function (score) { /* scoring: nothing to publish offline */ },
    },
    ad: {
      // Faithful shape: { type, beforeAd, afterAd, adBreakDone }.
      // Resolve instantly with breakStatus 'frequencyCapped' — the game
      // re-enables sound on that status. Never leaves callbacks dangling.
      break: function (opts) {
        opts = opts || {};
        var done = function () {
          try {
            if (typeof opts.adBreakDone === 'function') {
              opts.adBreakDone({ breakStatus: 'frequencyCapped' });
            }
          } catch (e) { /* ignored */ }
        };
        // beforeAd/afterAd still called so mute/unmute logic stays balanced.
        try { if (typeof opts.beforeAd === 'function') opts.beforeAd(); } catch (e) { /* ignored */ }
        try { if (typeof opts.afterAd === 'function') opts.afterAd(); } catch (e) { /* ignored */ }
        // Resolve on next tick so the call is asynchronous like a real break.
        setTimeout(done, 0);
      },
    },
    storage: {
      setItem: function (key, value) { safeSet(key, value); },
      getItem: function (key) { return safeGet(key); },
    },
  };

  // Publish the driver under the names the game checks.
  // (Game code refers to `GameDriver`; keep `GameSnacks` as an alias.)
  window.GameDriver = GameSnacks;
  window.GameSnacks = GameSnacks;

  // ---------- lifecycle bridging to document visibility ----------
  var driver = {
    onPauseCallback: null,
    onResumeCallback: null,
  };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (typeof driver.onPauseCallback === 'function') {
        try { driver.onPauseCallback(); } catch (e) { /* ignored */ }
      }
    } else {
      if (typeof driver.onResumeCallback === 'function') {
        try { driver.onResumeCallback(); } catch (e) { /* ignored */ }
      }
    }
  });

  // ---------- global crash guard: reload once, then give up ----------
  var lastReload = 0;
  window.addEventListener('error', function (ev) {
    // Only react to fatal script errors, not resource errors.
    if (!ev || !ev.message) return;
    var now = Date.now();
    if (now - lastReload < 30000) return; // 30 s cooldown
    var el = document.getElementById('crash-recovery');
    if (!el) {
      lastReload = now;
      setTimeout(function () { location.reload(); }, 50);
    }
  });
})();
