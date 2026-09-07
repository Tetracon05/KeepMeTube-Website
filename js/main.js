(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     Theme: light / dark / system, persisted in localStorage
     --------------------------------------------------------------------- */
  var THEME_KEY = "keepmetube-theme";
  var root = document.documentElement;
  var themeColorMeta = document.getElementById("theme-color-meta");

  function systemPrefersDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function resolvedIsDark(choice) {
    if (choice === "dark") return true;
    if (choice === "light") return false;
    return systemPrefersDark();
  }

  function applyTheme(choice) {
    if (choice === "light" || choice === "dark") {
      root.setAttribute("data-theme", choice);
    } else {
      root.removeAttribute("data-theme");
    }
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", resolvedIsDark(choice) ? "#111111" : "#ededed");
    }
    var buttons = document.querySelectorAll("[data-theme-choice]");
    for (var i = 0; i < buttons.length; i++) {
      var isActive = buttons[i].getAttribute("data-theme-choice") === choice;
      buttons[i].setAttribute("aria-checked", isActive ? "true" : "false");
    }
  }

  function applyThemeTransition(next, originEl) {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !originEl) {
      applyTheme(next);
      return;
    }

    var rect = originEl.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var maxX = Math.max(x, window.innerWidth - x);
    var maxY = Math.max(y, window.innerHeight - y);
    var r = Math.ceil(Math.sqrt(maxX * maxX + maxY * maxY));
    root.style.setProperty("--theme-x", x + "px");
    root.style.setProperty("--theme-y", y + "px");
    root.style.setProperty("--theme-r", r + "px");

    var sweep = document.createElement("div");
    sweep.className = "theme-sweep";
    sweep.style.background = getComputedStyle(root).getPropertyValue("--bg-0").trim();
    document.body.appendChild(sweep);

    root.classList.add("theme-transition-freeze");
    applyTheme(next);

    var fallback;
    function cleanup() {
      clearTimeout(fallback);
      sweep.removeEventListener("transitionend", onEnd);
      if (sweep.parentNode) sweep.parentNode.removeChild(sweep);
      root.classList.remove("theme-transition-freeze");
    }
    function onEnd(e) {
      if (e.target === sweep && e.propertyName === "clip-path") cleanup();
    }

    sweep.addEventListener("transitionend", onEnd);
    fallback = setTimeout(cleanup, 750);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { sweep.classList.add("is-collapsed"); });
    });
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    var choice = saved === "light" || saved === "dark" ? saved : "system";
    applyTheme(choice);

    var switchers = document.querySelectorAll("[data-theme-switch]");
    switchers.forEach(function (switcher) {
      switcher.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-theme-choice]");
        if (!btn) return;
        var next = btn.getAttribute("data-theme-choice");
        try { localStorage.setItem(THEME_KEY, next); } catch (err) {}
        applyThemeTransition(next, btn);
      });
    });

    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystemChange = function () {
      var current = null;
      try { current = localStorage.getItem(THEME_KEY); } catch (e) {}
      if (current !== "light" && current !== "dark" && themeColorMeta) {
        themeColorMeta.setAttribute("content", systemPrefersDark() ? "#111111" : "#ededed");
      }
    };
    if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
  }

  /* ---------------------------------------------------------------------
     Header: elevate once the page scrolls past the top
     --------------------------------------------------------------------- */
  function initHeaderScrollState() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var ticking = false;

    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------------
     Mobile nav
     --------------------------------------------------------------------- */
  function initMobileNav() {
    var toggle = document.querySelector("[data-menu-toggle]");
    var nav = document.querySelector("[data-mobile-nav]");
    if (!toggle || !nav) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var closeTimer = null;

    function close() {
      clearTimeout(closeTimer);
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-menu"></use></svg>';
      document.body.style.overflow = "";
      if (reduceMotion) {
        nav.hidden = true;
      } else {
        closeTimer = setTimeout(function () { nav.hidden = true; }, 320);
      }
    }
    function open() {
      clearTimeout(closeTimer);
      nav.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      toggle.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-close"></use></svg>';
      document.body.style.overflow = "hidden";
      if (reduceMotion) {
        nav.classList.add("is-open");
      } else {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { nav.classList.add("is-open"); });
        });
      }
    }

    toggle.addEventListener("click", function () {
      if (nav.hidden) open(); else close();
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") close();
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !nav.hidden) close();
    });
    window.matchMedia("(min-width: 900px)").addEventListener("change", function (mq) {
      if (mq.matches) close();
    });
  }

  /* ---------------------------------------------------------------------
     Compare sliders (light / dark drag comparison)
     --------------------------------------------------------------------- */
  function initCompareSliders() {
    var frames = document.querySelectorAll("[data-compare-frame]");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    frames.forEach(function (frame) {
      var handle = frame.querySelector("[data-compare-handle]");
      var dragging = false;
      var interacted = false;

      function setPos(pct) {
        pct = Math.max(0, Math.min(100, pct));
        frame.style.setProperty("--pos", pct + "%");
        handle.setAttribute("aria-valuenow", String(Math.round(pct)));
      }

      function pctFromClientX(clientX) {
        var rect = frame.getBoundingClientRect();
        return ((clientX - rect.left) / rect.width) * 100;
      }

      function onPointerMove(e) {
        if (!dragging) return;
        setPos(pctFromClientX(e.clientX));
      }
      function stopDragging() {
        dragging = false;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", stopDragging);
      }
      function startDragging(e) {
        interacted = true;
        frame.classList.remove("is-hinting");
        dragging = true;
        setPos(pctFromClientX(e.clientX));
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", stopDragging);
      }

      frame.addEventListener("pointerdown", startDragging);

      handle.addEventListener("keydown", function (e) {
        interacted = true;
        frame.classList.remove("is-hinting");
        var current = parseFloat(handle.getAttribute("aria-valuenow")) || 50;
        var step = e.shiftKey ? 20 : 5;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          setPos(current - step);
          e.preventDefault();
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          setPos(current + step);
          e.preventDefault();
        } else if (e.key === "Home") {
          setPos(0);
          e.preventDefault();
        } else if (e.key === "End") {
          setPos(100);
          e.preventDefault();
        }
      });

      setPos(50);

      if (!reduceMotion && "IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            io.unobserve(frame);
            setTimeout(function () {
              if (interacted) return;
              frame.classList.add("is-hinting");
              setPos(38);
              setTimeout(function () { if (!interacted) setPos(62); }, 260);
              setTimeout(function () { if (!interacted) setPos(50); }, 520);
              setTimeout(function () { frame.classList.remove("is-hinting"); }, 900);
            }, 500);
          });
        }, { threshold: 0.6 });
        io.observe(frame);
      }
    });
  }

  /* ---------------------------------------------------------------------
     Pointer-driven micro-interactions (mouse/trackpad only, motion-safe)
     --------------------------------------------------------------------- */
  function wantsPointerMotion() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function initHeroTilt() {
    var wrap = document.querySelector(".hero__shot");
    var picture = wrap && wrap.querySelector(".shot-frame picture");
    if (!wrap || !picture || !wantsPointerMotion()) return;

    var raf = null;
    wrap.addEventListener("pointermove", function (e) {
      var rect = wrap.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width;
      var py = (e.clientY - rect.top) / rect.height;
      var rx = (0.5 - py) * 8;
      var ry = (px - 0.5) * 8;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        picture.style.setProperty("--tilt-x", rx.toFixed(2) + "deg");
        picture.style.setProperty("--tilt-y", ry.toFixed(2) + "deg");
      });
    });
    wrap.addEventListener("pointerleave", function () {
      if (raf) cancelAnimationFrame(raf);
      picture.style.setProperty("--tilt-x", "0deg");
      picture.style.setProperty("--tilt-y", "0deg");
    });
  }

  function initCardSpotlight() {
    if (!wantsPointerMotion()) return;
    var raf = null;
    var containers = document.querySelectorAll(".feature-grid, .platform-cards");
    containers.forEach(function (container) {
      container.addEventListener("pointermove", function (e) {
        var card = e.target.closest(".feature-card, .platform-card");
        if (!card) return;
        var rect = card.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          card.style.setProperty("--mx", mx + "px");
          card.style.setProperty("--my", my + "px");
        });
      });
    });
  }

  /* ---------------------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------------------- */
  function initScrollReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !items.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    items.forEach(function (el) { el.setAttribute("data-reveal-pending", ""); });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, index) {
          if (entry.isIntersecting) {
            var el = entry.target;
            setTimeout(function () {
              el.removeAttribute("data-reveal-pending");
            }, index * 60);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------------------------------------------------------------
     GitHub releases: populate download buttons with live asset links

     Labels below are injected at runtime (after the release fetch
     resolves), so they can't come from the static per-language HTML the
     way the rest of the page's text does -- they're kept here instead,
     one small table per language, picked by document.documentElement.lang.
     --------------------------------------------------------------------- */
  var REPO = "Tetracon05/KeepMeTube";
  var RELEASES_URL = "https://github.com/" + REPO + "/releases";

  var ASSET_LABELS = {
    en: { macArm: "Download for Apple Silicon", macIntel: "Intel Mac", winExe: "Download installer", winMsi: "MSI package", linuxAppImage: "Download AppImage", mac: "Download for Mac", windows: "Download for Windows", linux: "Download for Linux", github: "Download on GitHub", latest: "Latest: " },
    tr: { macArm: "Apple Silicon için indir", macIntel: "Intel Mac", winExe: "Kurulum dosyasını indir", winMsi: "MSI paketi", linuxAppImage: "AppImage indir", mac: "Mac için indir", windows: "Windows için indir", linux: "Linux için indir", github: "GitHub'dan indir", latest: "Son sürüm: " },
    es: { macArm: "Descargar para Apple Silicon", macIntel: "Mac Intel", winExe: "Descargar instalador", winMsi: "Paquete MSI", linuxAppImage: "Descargar AppImage", mac: "Descargar para Mac", windows: "Descargar para Windows", linux: "Descargar para Linux", github: "Descargar desde GitHub", latest: "Última versión: " },
    fr: { macArm: "Télécharger pour Apple Silicon", macIntel: "Mac Intel", winExe: "Télécharger l'installeur", winMsi: "Paquet MSI", linuxAppImage: "Télécharger l'AppImage", mac: "Télécharger pour Mac", windows: "Télécharger pour Windows", linux: "Télécharger pour Linux", github: "Télécharger depuis GitHub", latest: "Dernière version : " },
    de: { macArm: "Für Apple Silicon herunterladen", macIntel: "Intel-Mac", winExe: "Installer herunterladen", winMsi: "MSI-Paket", linuxAppImage: "AppImage herunterladen", mac: "Für Mac herunterladen", windows: "Für Windows herunterladen", linux: "Für Linux herunterladen", github: "Von GitHub herunterladen", latest: "Neueste Version: " },
    pt: { macArm: "Baixar para Apple Silicon", macIntel: "Mac Intel", winExe: "Baixar instalador", winMsi: "Pacote MSI", linuxAppImage: "Baixar AppImage", mac: "Baixar para Mac", windows: "Baixar para Windows", linux: "Baixar para Linux", github: "Baixar do GitHub", latest: "Mais recente: " },
    ar: { macArm: "تحميل لمعالج Apple Silicon", macIntel: "Mac بمعالج Intel", winExe: "تحميل المثبّت", winMsi: "حزمة MSI", linuxAppImage: "تحميل AppImage", mac: "تحميل لنظام Mac", windows: "تحميل لنظام Windows", linux: "تحميل لنظام Linux", github: "تحميل من GitHub", latest: "أحدث إصدار: " },
    ja: { macArm: "Apple Silicon版をダウンロード", macIntel: "Intel Mac版", winExe: "インストーラーをダウンロード", winMsi: "MSIパッケージ", linuxAppImage: "AppImageをダウンロード", mac: "Mac版をダウンロード", windows: "Windows版をダウンロード", linux: "Linux版をダウンロード", github: "GitHubからダウンロード", latest: "最新版: " },
    ko: { macArm: "Apple Silicon용 다운로드", macIntel: "Intel Mac", winExe: "설치 프로그램 다운로드", winMsi: "MSI 패키지", linuxAppImage: "AppImage 다운로드", mac: "Mac용 다운로드", windows: "Windows용 다운로드", linux: "Linux용 다운로드", github: "GitHub에서 다운로드", latest: "최신 버전: " },
    "zh-Hans": { macArm: "下载 Apple Silicon 版", macIntel: "Intel Mac", winExe: "下载安装程序", winMsi: "MSI 安装包", linuxAppImage: "下载 AppImage", mac: "下载 Mac 版", windows: "下载 Windows 版", linux: "下载 Linux 版", github: "从 GitHub 下载", latest: "最新版本： " }
  };

  function assetLabels() {
    return ASSET_LABELS[document.documentElement.lang] || ASSET_LABELS.en;
  }

  function humanSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    var units = ["B", "KB", "MB", "GB"];
    var n = bytes, i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i > 0 ? n.toFixed(n < 10 ? 1 : 0) : n) + " " + units[i];
  }

  function findAsset(assets, test) {
    for (var i = 0; i < assets.length; i++) {
      if (test(assets[i].name.toLowerCase())) return assets[i];
    }
    return null;
  }

  function detectOS() {
    var platform = (navigator.platform || "").toLowerCase();
    var ua = navigator.userAgent || "";
    if (platform.indexOf("mac") !== -1 || /macintosh/i.test(ua)) return "mac";
    if (platform.indexOf("win") !== -1 || /windows/i.test(ua)) return "windows";
    if ((platform.indexOf("linux") !== -1 || /linux/i.test(ua)) && !/android/i.test(ua)) return "linux";
    return null;
  }

  function detectAppleSilicon() {
    try {
      var canvas = document.createElement("canvas");
      var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      var info = gl && gl.getExtension("WEBGL_debug_renderer_info");
      var renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
      if (/Apple M\d/i.test(renderer) || /Apple GPU/i.test(renderer)) return true;
      if (/Intel/i.test(renderer)) return false;
    } catch (e) {}
    return true; // most active Macs are Apple Silicon by now
  }

  function setAssetButton(key, asset, label) {
    var el = document.querySelector('[data-asset="' + key + '"]');
    if (!el || !asset) return;
    el.href = asset.browser_download_url;
    var labelEl = el.querySelector("[data-asset-label]");
    var text = label + " (" + humanSize(asset.size) + ")";
    if (labelEl) labelEl.textContent = text; else el.textContent = text;
  }

  function initReleaseData() {
    fetch("https://api.github.com/repos/" + REPO + "/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then(function (res) { if (!res.ok) throw new Error("release fetch failed"); return res.json(); })
      .then(function (release) {
        var assets = release.assets || [];
        var version = release.tag_name || "";

        var macArm = findAsset(assets, function (n) { return n.endsWith(".dmg") && n.indexOf("aarch64") !== -1; });
        var macIntel = findAsset(assets, function (n) { return n.endsWith(".dmg") && n.indexOf("aarch64") === -1; });
        var winExe = findAsset(assets, function (n) { return n.endsWith(".exe"); });
        var winMsi = findAsset(assets, function (n) { return n.endsWith(".msi"); });
        var linuxAppImage = findAsset(assets, function (n) { return n.endsWith(".appimage"); });
        var linuxDeb = findAsset(assets, function (n) { return n.endsWith(".deb"); });
        var linuxRpm = findAsset(assets, function (n) { return n.endsWith(".rpm"); });

        var labels = assetLabels();

        setAssetButton("mac-primary", macArm, labels.macArm);
        setAssetButton("mac-secondary", macIntel, labels.macIntel);
        setAssetButton("win-primary", winExe, labels.winExe);
        setAssetButton("win-secondary", winMsi, labels.winMsi);
        setAssetButton("linux-primary", linuxAppImage, labels.linuxAppImage);
        setAssetButton("linux-secondary", linuxDeb, ".deb");
        setAssetButton("linux-tertiary", linuxRpm, ".rpm");

        var versionEls = document.querySelectorAll("[data-version-badge], [data-version-badge-2]");
        versionEls.forEach(function (el) {
          el.textContent = version ? labels.latest + version : el.textContent;
        });

        var os = detectOS();
        var mainAsset = null;
        var mainLabel = null;
        if (os === "mac") {
          mainAsset = detectAppleSilicon() ? macArm : macIntel;
          mainLabel = labels.mac;
        } else if (os === "windows") {
          mainAsset = winExe;
          mainLabel = labels.windows;
        } else if (os === "linux") {
          mainAsset = linuxAppImage;
          mainLabel = labels.linux;
        }

        if (mainAsset) {
          var ctas = document.querySelectorAll("[data-download-cta]");
          ctas.forEach(function (cta) { cta.href = mainAsset.browser_download_url; });
          var labelEl = document.querySelector("[data-download-label]");
          if (labelEl) labelEl.textContent = mainLabel;
        }
      })
      .catch(function () {
        var ctas = document.querySelectorAll("[data-download-cta]");
        ctas.forEach(function (cta) { cta.href = RELEASES_URL; });
        var labelEl = document.querySelector("[data-download-label]");
        if (labelEl) labelEl.textContent = assetLabels().github;
      });
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  initTheme();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  function boot() {
    initHeaderScrollState();
    initMobileNav();
    initCompareSliders();
    initHeroTilt();
    initCardSpotlight();
    initScrollReveal();
    initReleaseData();
  }
})();
