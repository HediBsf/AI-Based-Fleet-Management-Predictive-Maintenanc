/* analytics.js
 * Google Analytics (gtag) + Microsoft Clarity
 * Load once, early (preferably in <head> or before </body>)
 */

(function () {
  'use strict';

  function log(msg) {
    console.log('[analytics.js]', msg);
  }

  /* =========================
     Google Analytics (gtag)
     ========================= */
  function initGoogleAnalytics() {
    const GA_ID = 'G-NLFL1XX2LD';
    if (!GA_ID) return;

    if (window.gtag) {
      log('Google Analytics already initialized');
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    const gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src =
      'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(gaScript);

    window.gtag('js', new Date());
    window.gtag('config', GA_ID);

    log('Google Analytics initialized');
  }

  /* =========================
     Microsoft Clarity
     ========================= */
  function initClarity() {
    const CLARITY_ID = 'v1wy7kqd4h';
    if (!CLARITY_ID) return;

    if (window.clarity) {
      log('Microsoft Clarity already initialized');
      return;
    }

    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);

    log('Microsoft Clarity initialized');
  }

  /* =========================
     Init All
     ========================= */
  function initAnalytics() {
    try {
      initGoogleAnalytics();
      initClarity();
    } catch (err) {
      console.error('[analytics.js] Init failed:', err);
    }
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalytics);
  } else {
    initAnalytics();
  }
})();
