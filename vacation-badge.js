(function(){
  // 🧹 Alte Dismiss-Flags IMMER entfernen (Kompatibilität mit früheren Versionen)
  try {
    localStorage.removeItem('vacation-badge-dismissed-until');
    sessionStorage.removeItem('vacation-badge-dismissed');
  } catch(e) {}

  function cssOnce(id, text){
    if (document.getElementById(id)) return;
    var s = document.createElement('style');
    s.id = id; s.textContent = text; document.head.appendChild(s);
  }
  function parseISO(d){ var a=(d||"").split("-").map(Number); return a.length===3?new Date(a[0],a[1]-1,a[2],0,0,0,0):null; }
  function fmtD(d){ var m=["Jän","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]; return d.getDate()+". "+m[d.getMonth()]+" "+d.getFullYear(); }

  // Styles
  cssOnce('vacation-badge-css', `
    :root { --vac-bg:#F5C8A7; --vac-fg:#2b2b2b; }
    .vacation-badge{
      position:fixed; left:18px; bottom:18px; z-index:99999;
      background:var(--vac-bg); color:var(--vac-fg);
      font:600 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      padding:12px 14px; border-radius:14px; box-shadow:0 6px 18px rgba(0,0,0,.12);
      display:none; max-width:min(80vw, 420px); letter-spacing:.2px;
    }
    .vacation-badge__text{ margin-right:28px; }
    .vacation-badge__close{
      position:absolute; top:6px; right:8px; width:22px; height:22px;
      border:0; background:transparent; color:inherit; cursor:pointer; opacity:.7;
    }
    .vacation-badge__close:after{ content:"✕"; font-size:14px; line-height:22px; }
    .vacation-badge__close:hover{ opacity:1; }
    @media (max-width:767px){
      .vacation-badge{ left:12px; bottom:12px; padding:10px 12px; }
      .vacation-badge__text{ margin-right:26px; font-size:13px; }
    }
  `);

  // ⚙️ KEIN Storage mehr – Close schließt nur visuell für diese Seite
  function makeBadge(text, color){
    if (color) document.documentElement.style.setProperty('--vac-bg', color);
    var div = document.createElement('div');
    div.className = 'vacation-badge';
    div.setAttribute('role','status');
    div.setAttribute('aria-live','polite');
    div.innerHTML = '<span class="vacation-badge__text"></span><button class="vacation-badge__close" aria-label="Hinweis schließen"></button>';
    div.querySelector('.vacation-badge__text').textContent = text;

    div.querySelector('.vacation-badge__close').addEventListener('click', function(){
      div.remove(); // kein Merken ⇒ erscheint beim nächsten Seitenaufruf wieder
    });

    return div;
  }

  function init(scriptEl){
    var cfgUrl = scriptEl.getAttribute('data-config');
    if (!cfgUrl) return;

    // Cachebuster stündlich, damit JSON-Updates zügig live werden
    var url = new URL(cfgUrl, location.href);
    url.searchParams.set('cb', new Date().toISOString().slice(0,13));

    fetch(url.toString(), { credentials:'omit' })
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(cfg){
        var start = parseISO(cfg.start), end = parseISO(cfg.end);
        if (!start || !end || isNaN(start) || isNaN(end) || start > end) return;
        var now = new Date();
        // während des Zeitraums anzeigen (inkl. ganzer Endtag)
        var active = now >= start && now <= new Date(end.getFullYear(),end.getMonth(),end.getDate(),23,59,59,999);
        if (!active) return;

        var text = (cfg.text && String(cfg.text).trim()) || ('Wir sind im Urlaub von '+fmtD(start)+' bis '+fmtD(end)+'.');
        var badge = makeBadge(text, cfg.color);
        if (!badge) return;
        document.body.appendChild(badge);
        badge.style.display = 'block';
      })
      .catch(function(e){ /* optional: console.warn('vacation-badge', e); */});
  }

  // Finde <script src="...vacation-badge.js" data-config="...">
  var current = document.currentScript;
  if (current) init(current);
})();
