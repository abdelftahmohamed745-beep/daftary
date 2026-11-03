'use strict';

/**
 * Boot guard — plain script (no modules) so it still runs when a module fails.
 * If the app never replaces the splash, we explain what happened and offer a
 * hard reload instead of leaving a frozen screen.
 */
(function () {
  var host = document.getElementById('app') || document.getElementById('public-app');
  if (!host) return;

  var started = Date.now();
  var problems = [];

  window.addEventListener(
    'error',
    function (event) {
      var target = event && event.target;
      if (target && target.tagName === 'SCRIPT') {
        problems.push('ملف مش اتحمّل: ' + (target.src || 'سكربت'));
      } else if (event && event.message) {
        problems.push(event.message);
      }
    },
    true,
  );

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    problems.push((reason && reason.message) || String(reason || 'خطأ غير معروف'));
  });

  function hardReload() {
    var url = new URL(location.href);
    url.searchParams.set('fresh', String(Date.now()));
    location.replace(url.toString());
  }

  function show() {
    if (!host.querySelector('[data-boot-splash]')) return;
    var detail = problems.length
      ? '<div style="font-size:12px;opacity:.65;margin-top:10px;direction:ltr;word-break:break-word">' +
        problems
          .slice(0, 2)
          .map(function (p) {
            return p.replace(/[<>&]/g, '');
          })
          .join('<br>') +
        '</div>'
      : '';
    host.innerHTML =
      '<div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;font-family:inherit">' +
      '<div style="max-width:430px">' +
      '<div style="width:58px;height:58px;border-radius:18px;background:#133a32;color:#f6f1e6;display:grid;place-items:center;font-size:26px;font-weight:700;margin:0 auto 18px">د</div>' +
      '<h1 style="font-size:20px;margin:0 0 8px;color:#133a32">الصفحة واقفة مش بتكمل تحميل</h1>' +
      '<p style="font-size:13px;line-height:1.8;color:#5d6b64;margin:0">غالبًا نسخة قديمة من الملفات محفوظة في المتصفح. جرّب التحديث القوي، ولو فضلت واقفة ابعتلنا الرسالة اللي تحت.</p>' +
      '<div style="display:flex;gap:8px;justify-content:center;margin-top:18px;flex-wrap:wrap">' +
      '<button type="button" data-retry style="border:0;border-radius:11px;background:#2f6f5e;color:#fff;font:inherit;font-weight:600;padding:11px 18px;cursor:pointer">حدّث الصفحة</button>' +
      '<button type="button" data-fresh style="border:1px solid #d8d2c4;border-radius:11px;background:#fff;color:#133a32;font:inherit;font-weight:600;padding:11px 18px;cursor:pointer">تحديث بدون كاش</button>' +
      '</div>' +
      detail +
      '</div></div>';
    host.querySelector('[data-retry]').addEventListener('click', function () {
      location.reload();
    });
    host.querySelector('[data-fresh]').addEventListener('click', hardReload);
  }

  // Give slow connections and cold serverless starts a fair chance first.
  var timer = setInterval(function () {
    if (!host.querySelector('[data-boot-splash]')) {
      clearInterval(timer);
      return;
    }
    if (Date.now() - started > 12000) {
      clearInterval(timer);
      show();
    }
  }, 600);

  window.daftaryBootGuard = { show: show };
})();
