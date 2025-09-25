(function(){
  // --- Utility ------------------------------------------------------------
  function cssOnce(id, text){
    if (document.getElementById(id)) return;
    var s = document.createElement('style');
    s.id = id; s.textContent = text; document.head.appendChild(s);
  }
  function parseISO(d){ var a=(d||"").split("-").map(Number); return a.length===3?new Date(a[0],a[1]-1,a[2],0,0,0,0):null; }
  function fmtD(d){ var m=["Jän","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]; return d.getDate()+". "+m[d.getMonth()]+" "+d.getFullYear(); }

  // --- Styles -------------------------------------------------------------
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

  // --- State: pro-URL "geschlossen"-Status (nur im Speicher, nicht persistent) ----
  var closedForUrl = null;
  function currentUrlKey(){ return location.pathname + location.search; }

  // --- Build badge --------------------------------------------------------
  function buildBadge(text, color){
    if (color) document.documentElement.style.setProperty('--vac-bg', color);
    var div = document.createElement('div');
    div.className = 'vacation-badge';
    div.setAttribute('role','status');
    div.setAttribute('aria-live','polite');
    div.innerHTML = '<span class="vacation-badge__text"></span><button class="vacation-badge__close" aria-label="Hinweis schließen"></button>';
    div.querySelector('.vacation-badge__text').textContent = text;

    div.querySelector('.vacation-badge__close').addEventListener('click', function(){
      // nur für die aktuelle "Seite" (URL) schließen; auf neuer URL wieder zeigen
      closedForUrl = currentUrlKey();
      div.remove();
    });

    return div;
  }

  // --- Mount/Unmount Logic -----------------------------------------------
  var cfgCache = null;   // merke geladene Config, um nicht ständig neu zu fetchen
  var activeFlag = false;

  function isActivePeriod(cfg){
    var start = parseISO(cfg.start), end = parseISO(cfg.end);
    if (!start || !end || isNaN(start) || isNaN(end) || start > end) return false;
    var now = new Date();
    var tillEndOfDay = new Date(end.getFullYear(),end.getMonth(),end.getDate(),23,59,59,999);
    return now >= start && now <= tillEndOfDay;
  }

  function mountIfNeeded(){
    // wenn für diese URL geschlossen → nicht sofort remounten
    if (closedForUrl === currentUrlKey()) return;

    var cfg = cfgCache;
    if (!cfg) return;

    if (!isActivePeriod(cfg)) return;

    // falls schon vorhanden, nix tun
    if (document.querySelector('.vacation-badge')) return;

    var text = (cfg.text && String(cfg.text).trim()) || ('Wir sind im Urlaub von '+fmtD(parseISO(cfg.start))+' bis '+fmtD(parseISO(cfg.end))+'.');
    var badge = buildBadge(text, cfg.color);
    document.body.appendChild(badge);
    badge.style.display = 'block';
  }

  function fetchConfig(scriptEl){
    var cfgUrl = scriptEl.getAttribute('data-config');
    if (!cfgUrl) return Promise.resolve(null);

    // Cachebuster stündlich, damit JSON-Änderungen zügig live werden
    var url = new URL(cfgUrl, location.href);
    url.searchParams.set('cb', new Date().toISOString().slice(0,13));

    return fetch(url.toString(), { credentials:'omit' })
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(cfg){ cfgCache = cfg; return cfg; });
  }

  // --- SPA-awareness: auf URL-Wechsel remounten --------------------------
  function hookHistory(){
    var _ps = history.pushState, _rs = history.replaceState;
    function onChange(){
      // bei URL-Wechsel darf wieder gemountet werden
      closedForUrl = null;
      // kleines Timeout, bis DOM der „neuen Seite“ steht
      setTimeout(mountIfNeeded, 60);
    }
    history.pushState = function(){ var r=_ps.apply(this, arguments); onChange(); return r; };
    history.replaceState = function(){ var r=_rs.apply(this, arguments); onChange(); return r; };
    window.addEventListener('popstate', onChange);
  }

  // Fallback: MutationObserver – falls ein Theme ohne History-Hooks arbeitet
  var mo = null;
  function observeDom(){
    try {
      if (mo) mo.disconnect();
      mo = new MutationObserver(function(){
        // wenn Badge fehlt und nicht absichtlich für diese URL geschlossen → mount
        if (!document.querySelector('.vacation-badge')) mountIfNeeded();
      });
      mo.observe(document.body, { childList:true, subtree:true });
    } catch(e){}
  }

  // --- Init ---------------------------------------------------------------
  var current = document.currentScript;
  if (!current) return;

  hookHistory();
  observeDom();

  fetchConfig(current).then(function(){
    mountIfNeeded();
  }).catch(function(){ /* ignore */ });

  // sicherheitshalber auch bei pageshow (Back/Forward Cache) erneut versuchen
  window.addEventListener('pageshow', function(){ closedForUrl = null; mountIfNeeded(); });
})();
