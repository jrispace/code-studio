/* Code Studio — offline QR generator with content types, styling and exports.
   JRiSpace | Sylvenson Richard */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- setup */
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

  var $ = function (id) { return document.getElementById(id); };
  function T(key, vars) { return window.CS ? CS.t(key, vars) : key; }
  function Topt(field, value, fallback) {
    var k = "opt." + field.k + "." + value;
    var s = T(k);
    return s === k ? fallback : s;
  }
  var canvas = $("qrCanvas"), ctx = canvas.getContext("2d");
  var state = { qr: null, count: 0, payload: "", type: "link", logo: null, logoDataUrl: "", logoToken: 0, dims: null };
  var timer = null;
  var exportIds = ["dlPng", "dlSvg", "dlPdf", "dlJpg", "copyBtn"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function enc(s) { return encodeURIComponent(String(s == null ? "" : s)); }

  /* ------------------------------------------------------------ icon set */
  var ICON = {
    link: '<path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1"/>',
    text: '<path d="M5 6h14M5 12h14M5 18h9"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    phone: '<path d="M6 3h3l2 5-2 1a12 12 0 006 6l1-2 5 2v3a2 2 0 01-2 2A17 17 0 014 5a2 2 0 012-2z"/>',
    sms: '<path d="M21 12a8 8 0 01-8 8H8l-5 3 1.5-5A8 8 0 1121 12z"/>',
    whatsapp: '<path d="M20 12a8 8 0 01-11.8 7L4 20l1-4.2A8 8 0 1120 12z"/><path d="M9 9.5c.5 3 2.5 5 5.5 5.5"/>',
    wifi: '<path d="M2 8.5a16 16 0 0120 0M5.5 12a11 11 0 0113 0M9 15.5a6 6 0 016 0"/><circle cx="12" cy="19" r="1"/>',
    vcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.6 1.8-2.4 3-2.4s2.4.8 3 2.4M14.5 10h4M14.5 13.5h4"/>',
    event: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    geo: '<path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    social: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6"/>',
    app: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4"/><circle cx="12" cy="18" r="1"/>',
    file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>'
  };
  function iconSvg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICON[name] || ICON.link) + "</svg>";
  }

  /* --------------------------------------------------------------- types */
  /* f: key, l: label, t: input type, ph: placeholder, req: required, half: half width */
  var TYPES = [
    { id: "link", label: "Link", icon: "link", fields: [
      { k: "url", l: "Website URL", t: "url", ph: "https://example.com", req: true, norm: "url" } ] },
    { id: "text", label: "Text", icon: "text", fields: [
      { k: "text", l: "Message (max 1000)", t: "textarea", ph: "Any text…", req: true, max: 1000 } ] },
    { id: "email", label: "E-mail", icon: "mail", fields: [
      { k: "to", l: "Recipient", t: "email", ph: "name@example.com", req: true },
      { k: "subject", l: "Subject", t: "text", ph: "Hello" },
      { k: "body", l: "Message", t: "textarea", ph: "Write your message…" } ] },
    { id: "call", label: "Call", icon: "phone", fields: [
      { k: "phone", l: "Phone number", t: "tel", ph: "+1 555 010 0199", req: true } ] },
    { id: "sms", label: "SMS", icon: "sms", fields: [
      { k: "phone", l: "Phone number", t: "tel", ph: "+1 555 010 0199", req: true },
      { k: "message", l: "Message", t: "textarea", ph: "Pre-filled SMS text" } ] },
    { id: "whatsapp", label: "WhatsApp", icon: "whatsapp", fields: [
      { k: "phone", l: "Phone (with country code)", t: "tel", ph: "+1 555 010 0199", req: true },
      { k: "message", l: "Message", t: "textarea", ph: "Pre-filled WhatsApp text" } ] },
    { id: "wifi", label: "Wi-Fi", icon: "wifi", fields: [
      { k: "ssid", l: "Network name (SSID)", t: "text", ph: "MyNetwork", req: true },
      { k: "password", l: "Password", t: "text", ph: "network password" },
      { k: "enc", l: "Encryption", t: "select", opts: [["WPA", "WPA / WPA2 / WPA3"], ["WEP", "WEP"], ["nopass", "Open (no password)"]] },
      { k: "hidden", l: "Hidden network", t: "check" } ] },
    { id: "vcard", label: "vCard", icon: "vcard", fields: [
      { k: "first", l: "First name", t: "text", ph: "Jane", req: true, half: true },
      { k: "last", l: "Last name", t: "text", ph: "Doe", half: true },
      { k: "mobile", l: "Mobile", t: "tel", ph: "+1 555 010 0199", half: true },
      { k: "phone", l: "Phone", t: "tel", ph: "+1 555 010 0200", half: true },
      { k: "email", l: "Email", t: "email", ph: "jane@example.com", half: true },
      { k: "org", l: "Company", t: "text", ph: "Example Inc.", half: true },
      { k: "title", l: "Job title", t: "text", ph: "Product Manager", half: true },
      { k: "url", l: "Website", t: "url", ph: "https://example.com", half: true },
      { k: "street", l: "Street", t: "text", ph: "123 Main Street", half: true },
      { k: "city", l: "City", t: "text", ph: "Springfield", half: true },
      { k: "zip", l: "Post code", t: "text", ph: "12345", half: true },
      { k: "country", l: "Country", t: "text", ph: "United States", half: true },
      { k: "note", l: "Note", t: "textarea", ph: "Anything else" } ] },
    { id: "event", label: "Event", icon: "event", fields: [
      { k: "title", l: "Event title", t: "text", ph: "Product launch", req: true },
      { k: "location", l: "Location", t: "text", ph: "123 Main Street" },
      { k: "start", l: "Starts", t: "datetime-local", req: true },
      { k: "end", l: "Ends", t: "datetime-local" },
      { k: "desc", l: "Description", t: "textarea", ph: "What is it about" } ] },
    { id: "geo", label: "Location", icon: "geo", fields: [
      { k: "lat", l: "Latitude", t: "text", ph: "40.7128", req: true, half: true },
      { k: "lng", l: "Longitude", t: "text", ph: "-74.0060", req: true, half: true } ] },
    { id: "social", label: "Social", icon: "social", fields: [
      { k: "fb", l: "Facebook", t: "url", ph: "https://facebook.com/…", half: true },
      { k: "ig", l: "Instagram", t: "url", ph: "https://instagram.com/…", half: true },
      { k: "x", l: "X / Twitter", t: "url", ph: "https://x.com/…", half: true },
      { k: "li", l: "LinkedIn", t: "url", ph: "https://linkedin.com/in/…", half: true },
      { k: "tt", l: "TikTok", t: "url", ph: "https://tiktok.com/@…", half: true },
      { k: "yt", l: "YouTube", t: "url", ph: "https://youtube.com/@…", half: true },
      { k: "web", l: "Website", t: "url", ph: "https://jrispace.com" } ] },
    { id: "app", label: "App", icon: "app", fields: [
      { k: "store", l: "Store", t: "select", opts: [["ios", "App Store (iOS)"], ["android", "Google Play (Android)"], ["both", "Both links (text)"]] },
      { k: "ios", l: "App Store URL", t: "url", ph: "https://apps.apple.com/app/id…" },
      { k: "android", l: "Google Play URL", t: "url", ph: "https://play.google.com/store/apps/details?id=…" } ] },
    { id: "file", label: "File link", icon: "file", fields: [
      { k: "url", l: "Public file URL (PDF, image, video)", t: "url", ph: "https://…/menu.pdf", req: true, norm: "url" },
      { k: "note", l: "Caption", t: "text", ph: "Menu (PDF)" } ] }
  ];

  /* ------------------------------------------------------- form handling */
  var form = {};
  var requiredMissing = [];
  var touched = false;

  function typeDef(id) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i];
    return TYPES[0];
  }
  function fieldValue(type, k) {
    var f = form[type] || (form[type] = {});
    if (f[k] == null) {
      var defs = typeDef(type).fields;
      for (var i = 0; i < defs.length; i++) if (defs[i].k === k) {
        if (defs[i].t === "select") f[k] = defs[i].opts[0][0];
        else if (defs[i].t === "check") f[k] = false;
        else f[k] = "";
      }
    }
    return f[k];
  }

  function fieldHtml(type, f) {
    var v = fieldValue(type, f.k);
    var id = "f_" + type + "_" + f.k;
    var lKey = "f." + f.k, label = T(lKey);
    if (label === lKey) label = f.l;
    var pKey = "ph." + f.k, ph = T(pKey);
    if (ph === pKey) ph = f.ph || "";
    var html = "";
    if (f.t === "textarea") {
      html += '<textarea id="' + id + '" data-k="' + f.k + '" placeholder="' + esc(ph) + '"' +
        (f.max ? ' maxlength="' + f.max + '"' : "") + ">" + esc(v) + "</textarea>";
    } else if (f.t === "select") {
      html += '<select id="' + id + '" data-k="' + f.k + '">';
      for (var i = 0; i < f.opts.length; i++) {
        html += '<option value="' + esc(f.opts[i][0]) + '"' + (String(v) === f.opts[i][0] ? " selected" : "") + ">" +
          esc(Topt(f, f.opts[i][0], f.opts[i][1])) + "</option>";
      }
      html += "</select>";
    } else if (f.t === "check") {
      return '<label class="check" style="margin-top:12px"><input type="checkbox" data-k="' + f.k + '"' + (v ? " checked" : "") + "> " + esc(label) + "</label>";
    } else {
      html += '<input type="' + f.t + '" id="' + id + '" data-k="' + f.k + '" value="' + esc(v) + '" placeholder="' + esc(ph) + '" maxlength="' + (f.max || 512) + '">';
    }
    return '<div class="fld"' + (f.half ? ' style="grid-column:auto"' : "") + '><label for="' + id + '">' + esc(label) +
      (f.req ? ' <span class="req">*</span>' : "") + "</label>" + html + "</div>";
  }

  function renderFields() {
    var type = state.type, def = typeDef(type), out = "";
    var halves = def.fields.filter(function (f) { return f.half; });
    var rest = def.fields.filter(function (f) { return !f.half; });
    if (halves.length) {
      out += '<div class="row fld" style="margin-top:14px">' + halves.map(function (f) { return fieldHtml(type, f); }).join("") + "</div>";
    }
    out += rest.map(function (f) { return fieldHtml(type, f); }).join("");
    $("typeFields").innerHTML = out;
    var tkey = "types." + def.id, tval = T(tkey);
    $("typeBadge").textContent = (tval === tkey ? def.label : tval).toLowerCase();
  }

  function renderTypeGrid() {
    $("typeGrid").innerHTML = TYPES.map(function (t) {
      var lblKey = "types." + t.id, lbl = T(lblKey);
      if (lbl === lblKey) lbl = t.label;
      return '<button type="button" class="tbtn" data-type="' + t.id + '" aria-pressed="' + (t.id === state.type) + '">' +
        iconSvg(t.icon) + "<span>" + esc(lbl) + "</span></button>";
    }).join("");
  }

  $("typeGrid").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-type]");
    if (!b) return;
    state.type = b.getAttribute("data-type");
    touched = true;
    renderTypeGrid(); renderFields(); build();
  });

  $("typeFields").addEventListener("input", function (e) {
    var el = e.target;
    if (!el || !el.dataset || !el.dataset.k) return;
    var t = state.type;
    if (!form[t]) form[t] = {};
    form[t][el.dataset.k] = el.type === "checkbox" ? el.checked : el.value;
    touched = true;
    schedule();
  });
  $("typeFields").addEventListener("change", function (e) {
    var el = e.target;
    if (!el || !el.dataset || !el.dataset.k) return;
    if (!form[state.type]) form[state.type] = {};
    form[state.type][el.dataset.k] = el.type === "checkbox" ? el.checked : el.value;
    schedule();
  });

  /* ------------------------------------------------------------ payloads */
  function normalizeUrl(u) {
    var v = String(u || "").trim();
    if (!v) return "";
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(v)) return "https://" + v;
    return v;
  }
  function digits(s) { return String(s || "").replace(/[^\d]/g, ""); }
  function wifEsc(s) { return String(s || "").replace(/([\\;,:"])/g, "\\$1"); }
  function vEsc(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
  function icsDate(v) {
    if (!v) return "";
    var d = new Date(v);
    if (isNaN(d.getTime())) return "";
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + "00Z";
  }

  function buildPayload() {
    var t = state.type;
    var g = function (k) { return fieldValue(t, k); };
    var miss = [];
    function need(k, label) { if (!String(g(k) || "").trim()) miss.push(label); return String(g(k) || "").trim(); }

    switch (t) {
      case "link":
        return { payload: normalizeUrl(need("url", "Website URL")), missing: miss };
      case "text": {
        var t1 = need("text", "Message").slice(0, 1000);
        return { payload: t1, missing: miss };
      }
      case "email": {
        var to = need("to", "Recipient");
        var q = [];
        if (g("subject")) q.push("subject=" + enc(g("subject")));
        if (g("body")) q.push("body=" + enc(g("body")));
        return { payload: to ? "mailto:" + to + (q.length ? "?" + q.join("&") : "") : "", missing: miss };
      }
      case "call": {
        var raw = need("phone", "Phone number");
        var plus = /^\s*\+/.test(raw) ? "+" : "";
        return { payload: raw ? "tel:" + plus + digits(raw) : "", missing: miss };
      }
      case "sms": {
        var p = need("phone", "Phone number");
        var m = String(g("message") || "");
        return { payload: p ? "SMSTO:" + p + (m ? ":" + m : "") : "", missing: miss };
      }
      case "whatsapp": {
        var w = need("phone", "Phone");
        var wm = String(g("message") || "");
        return { payload: w ? "https://wa.me/" + digits(w) + (wm ? "?text=" + enc(wm) : "") : "", missing: miss };
      }
      case "wifi": {
        var ssid = need("ssid", "Network name");
        var encMode = String(g("enc") || "WPA");
        var pass = String(g("password") || "");
        if (encMode !== "nopass" && !pass) miss.push("Password");
        return {
          payload: ssid ? "WIFI:T:" + encMode + ";S:" + wifEsc(ssid) + ";" +
            (encMode === "nopass" ? "" : "P:" + wifEsc(pass) + ";") +
            (g("hidden") ? "H:true;" : "") + ";" : "",
          missing: miss
        };
      }
      case "vcard": {
        var first = need("first", "First name");
        var L = ["BEGIN:VCARD", "VERSION:3.0",
          "N:" + vEsc(g("last")) + ";" + vEsc(first) + ";;;",
          "FN:" + vEsc((first + " " + String(g("last") || "")).trim())];
        if (g("org")) L.push("ORG:" + vEsc(g("org")));
        if (g("title")) L.push("TITLE:" + vEsc(g("title")));
        if (g("mobile")) L.push("TEL;TYPE=CELL:" + vEsc(g("mobile")));
        if (g("phone")) L.push("TEL;TYPE=WORK:" + vEsc(g("phone")));
        if (g("email")) L.push("EMAIL;TYPE=INTERNET:" + vEsc(g("email")));
        if (g("url")) L.push("URL:" + vEsc(g("url")));
        if (g("street") || g("city") || g("zip") || g("country"))
          L.push("ADR;TYPE=WORK:;;" + vEsc(g("street")) + ";" + vEsc(g("city")) + ";;" + vEsc(g("zip")) + ";" + vEsc(g("country")));
        if (g("note")) L.push("NOTE:" + vEsc(g("note")));
        L.push("END:VCARD");
        return { payload: first ? L.join("\n") : "", missing: miss };
      }
      case "event": {
        var title = need("title", "Event title");
        var start = need("start", "Start date");
        var L2 = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
          "SUMMARY:" + vEsc(title),
          "DTSTART:" + icsDate(start),
          "DTEND:" + (icsDate(g("end")) || icsDate(start)),
          "LOCATION:" + vEsc(g("location")),
          "DESCRIPTION:" + vEsc(g("desc")),
          "END:VEVENT", "END:VCALENDAR"];
        return { payload: title && start ? L2.join("\n") : "", missing: miss };
      }
      case "geo": {
        var lat = need("lat", "Latitude"), lng = need("lng", "Longitude");
        return { payload: lat && lng ? "geo:" + lat + "," + lng : "", missing: miss };
      }
      case "social": {
        var rows = [], any = false;
        [["fb", "Facebook"], ["ig", "Instagram"], ["x", "X"], ["li", "LinkedIn"], ["tt", "TikTok"], ["yt", "YouTube"], ["web", "Website"]]
          .forEach(function (pair) {
            var v = String(g(pair[0]) || "").trim();
            if (v) { rows.push(pair[1] + ": " + normalizeUrl(v)); any = true; }
          });
        if (!any) miss.push("At least one profile");
        return { payload: any ? rows.join("\n") : "", missing: miss };
      }
      case "app": {
        var mode = String(g("store") || "ios");
        var ios = String(g("ios") || "").trim(), and = String(g("android") || "").trim();
        if (mode === "ios") { if (!ios) miss.push("App Store URL"); return { payload: normalizeUrl(ios), missing: miss }; }
        if (mode === "android") { if (!and) miss.push("Google Play URL"); return { payload: normalizeUrl(and), missing: miss }; }
        if (!ios && !and) miss.push("At least one store URL");
        return { payload: [ios ? "iOS: " + normalizeUrl(ios) : "", and ? "Android: " + normalizeUrl(and) : ""].filter(Boolean).join("\n"), missing: miss };
      }
      case "file": {
        var u = need("url", "File URL");
        var cap = String(g("note") || "");
        return { payload: u ? normalizeUrl(u) : "", missing: miss };
      }
    }
    return { payload: "", missing: ["Content"] };
  }

  /* --------------------------------------------------------------- style */
  function styleOpts() {
    return {
      ecc: $("ecc").value,
      size: Math.min(4000, Math.max(100, parseInt($("size").value, 10) || 1000)),
      margin: Math.min(16, Math.max(0, parseInt($("margin").value, 10) || 0)),
      fg: $("fg").value,
      fg2: $("fg2").value,
      bg: $("bg").value,
      grad: $("gradMode").value,
      angle: parseInt($("gradAngle").value, 10) || 45,
      eyeColor: $("eyeColor").value,
      dot: activeOf("dotStyles", "dot"),
      eye: activeOf("eyeStyles", "eye"),
      transparent: $("transparent").checked,
      frame: $("frameOn").checked,
      frameText: $("frameText").value,
      frameFont: $("frameFont").value,
      frameColor: $("frameColor").value,
      frameTextColor: $("frameTextColor").value,
      logoPct: Math.min(30, Math.max(10, parseInt($("logoPct").value, 10) || 22)),
      logoPlate: $("logoPlate").checked
    };
  }
  function activeOf(containerId, attr) {
    var el = $(containerId).querySelector('[aria-pressed="true"]');
    return el ? el.getAttribute("data-" + attr) : "";
  }

  var DOTS = [["square", "Square"], ["rounded", "Rounded"], ["dots", "Dots"], ["diamond", "Diamond"], ["classy", "Classy"]];
  var EYES = [["square", "Square"], ["rounded", "Rounded"], ["circle", "Circle"]];

  function buildStylePickers() {
    $("dotStyles").innerHTML = DOTS.map(function (d) {
      var k = "shape." + d[0], lbl = T(k);
      return '<button type="button" class="sty" data-dot="' + d[0] + '" aria-pressed="' + (d[0] === "rounded") + '">' +
        '<canvas width="28" height="28" data-preview="dot:' + d[0] + '"></canvas>' + esc(lbl === k ? d[1] : lbl) + "</button>";
    }).join("");
    $("eyeStyles").innerHTML = EYES.map(function (e) {
      var k = "corner." + e[0], lbl = T(k);
      return '<button type="button" class="sty" data-eye="' + e[0] + '" aria-pressed="' + (e[0] === "rounded") + '">' +
        '<canvas width="28" height="28" data-preview="eye:' + e[0] + '"></canvas>' + esc(lbl === k ? e[1] : lbl) + "</button>";
    }).join("");
    var all = document.querySelectorAll("#dotStyles canvas, #eyeStyles canvas");
    Array.prototype.forEach.call(all, function (cv) { drawStyleThumb(cv); });
  }

  function drawStyleThumb(cv) {
    var c = cv.getContext("2d");
    var spec = cv.getAttribute("data-preview").split(":");
    var w = cv.width, unit = w / 7;
    c.clearRect(0, 0, w, w);
    c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#111";
    if (spec[0] === "dot") {
      var u = w / 3.1;
      for (var r = 0; r < 3; r++) {
        for (var col = 0; col < 3; col++) {
          if (r === 1 && col === 1) continue;
          var d = cellPathString((col + 0.1) * u, (r + 0.1) * u, u * 0.86, spec[1],
            { up: r === 0, left: col === 0, right: col === 2, down: r === 2 });
          c.fill(new Path2D(d));
        }
      }
    } else {
      var u2 = (w - 2) / 7;
      var p = eyePathString(1, 1, spec[1], u2);
      c.fill(new Path2D(p.ring), "evenodd");
      c.fill(new Path2D(p.ball));
    }
  }

  $("dotStyles").addEventListener("click", function (e) {
    var b = e.target.closest("[data-dot]"); if (!b) return;
    setPressed("dotStyles", b, "dot"); build();
  });
  $("eyeStyles").addEventListener("click", function (e) {
    var b = e.target.closest("[data-eye]"); if (!b) return;
    setPressed("eyeStyles", b, "eye"); build();
  });
  function setPressed(containerId, btn, attr) {
    Array.prototype.forEach.call($(containerId).querySelectorAll("[" + "data-" + attr + "]"), function (el) {
      el.setAttribute("aria-pressed", String(el === btn));
    });
  }

  /* --------------------------------------------------------- geometry/draw */
  function geometry(count, o) {
    var total = count + o.margin * 2;
    var mod = Math.max(1, Math.floor(o.size / total));
    var grid = total * mod;
    var offset = Math.max(0, Math.floor((o.size - grid) / 2));
    var pad = o.frame ? Math.round(o.size * 0.045) : 0;
    var band = o.frame ? Math.max(Math.round(o.size * 0.1), 34) : 0;
    return {
      count: count, total: total, mod: mod, offset: offset, size: o.size,
      pad: pad, band: band,
      width: o.size + pad * 2,
      height: o.size + pad * 2 + band
    };
  }

  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return "M" + (x + r) + " " + y +
      "H" + (x + w - r) + "A" + r + " " + r + " 0 0 1 " + (x + w) + " " + (y + r) +
      "V" + (y + h - r) + "A" + r + " " + r + " 0 0 1 " + (x + w - r) + " " + (y + h) +
      "H" + (x + r) + "A" + r + " " + r + " 0 0 1 " + x + " " + (y + h - r) +
      "V" + (y + r) + "A" + r + " " + r + " 0 0 1 " + (x + r) + " " + y + "Z";
  }
  function circlePath(cx, cy, r) {
    return "M" + (cx - r) + " " + cy + "a" + r + " " + r + " 0 1 0 " + (2 * r) + " 0a" + r + " " + r + " 0 1 0 " + (-2 * r) + " 0Z";
  }
  /* per-corner rounded rect (radii: [tl, tr, br, bl]) */
  function cornersPath(x, y, w, h, rr) {
    var tl = Math.min(rr[0], w / 2, h / 2), tr = Math.min(rr[1], w / 2, h / 2),
        br = Math.min(rr[2], w / 2, h / 2), bl = Math.min(rr[3], w / 2, h / 2);
    return "M" + (x + tl) + " " + y +
      "H" + (x + w - tr) + (tr ? "A" + tr + " " + tr + " 0 0 1 " + (x + w) + " " + (y + tr) : "") +
      "V" + (y + h - br) + (br ? "A" + br + " " + br + " 0 0 1 " + (x + w - br) + " " + (y + h) : "") +
      "H" + (x + bl) + (bl ? "A" + bl + " " + bl + " 0 0 1 " + x + " " + (y + h - bl) : "") +
      "V" + (y + tl) + (tl ? "A" + tl + " " + tl + " 0 0 1 " + (x + tl) + " " + y : "") + "Z";
  }

  function cellPathString(x, y, s, style, neighbours) {
    if (style === "square") return "M" + x + " " + y + "h" + s + "v" + s + "h" + (-s) + "Z";
    if (style === "dots") return circlePath(x + s / 2, y + s / 2, s * 0.46);
    if (style === "diamond") {
      var h = s / 2;
      return "M" + (x + h) + " " + y + "L" + (x + s) + " " + (y + h) + "L" + (x + h) + " " + (y + s) + "L" + x + " " + (y + h) + "Z";
    }
    var rad = style === "classy" ? s * 0.52 : s * 0.34;
    var rr = [rad, rad, rad, rad];
    if (neighbours) {
      if (neighbours.up) { rr[0] = 0; rr[1] = 0; }
      if (neighbours.right) { rr[1] = 0; rr[2] = 0; }
      if (neighbours.down) { rr[2] = 0; rr[3] = 0; }
      if (neighbours.left) { rr[3] = 0; rr[0] = 0; }
    }
    return cornersPath(x, y, s, s, rr);
  }

  function eyeRects(count) {
    return [[0, 0], [count - 7, 0], [0, count - 7]];
  }

  function eyePathString(ox, oy, style, mod) {
    var big = 7 * mod, small = 5 * mod, inner = 3 * mod;
    var R, Ri;
    if (style === "circle") { R = big / 2; Ri = small / 2; }
    else if (style === "rounded") { R = mod * 1.9; Ri = mod * 1.1; }
    else { R = 0; Ri = 0; }
    var outer, hole, ball;
    if (style === "circle") {
      outer = circlePath(ox + big / 2, oy + big / 2, R);
      hole = circlePath(ox + big / 2, oy + big / 2, Ri);
      ball = circlePath(ox + big / 2, oy + big / 2, inner / 2);
    } else {
      outer = roundRectPath(ox, oy, big, big, R);
      hole = roundRectPath(ox + mod, oy + mod, small, small, Ri);
      ball = roundRectPath(ox + 2 * mod, oy + 2 * mod, inner, inner, Math.min(Ri, mod * 0.6));
    }
    return { ring: outer + hole, ball: ball };
  }

  function symbolPaths(qr, o, g) {
    var count = g.count, mod = g.mod;
    var ox = g.pad + g.offset + o.margin * mod;
    var oy = g.pad + g.offset + o.margin * mod;
    var eyes = eyeRects(count);
    function inEye(c, r) {
      for (var i = 0; i < eyes.length; i++) {
        var e = eyes[i];
        if (c >= e[0] - 1 && c <= e[0] + 7 && r >= e[1] - 1 && r <= e[1] + 7) return true;
      }
      return false;
    }
    function isDark(c, r) {
      if (c < 0 || r < 0 || c >= count || r >= count) return false;
      return qr.isDark(r, c);
    }
    var body = "";
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (!qr.isDark(r, c) || inEye(c, r)) continue;
        var s = mod, x = ox + c * s, y = oy + r * s;
        body += cellPathString(x, y, s, o.dot, {
          up: isDark(c, r - 1), right: isDark(c + 1, r), down: isDark(c, r + 1), left: isDark(c - 1, r)
        });
      }
    }
    var rings = "", balls = "";
    for (var i = 0; i < eyes.length; i++) {
      var p = eyePathString(ox + eyes[i][0] * mod, oy + eyes[i][1] * mod, o.eye, mod);
      rings += p.ring; balls += p.ball;
    }
    return { body: body, rings: rings, balls: balls };
  }

  function logoBox(count, g, o) {
    var area = count * g.mod;
    var cap = Math.floor(area * 0.25);
    var side = Math.min(Math.round(area * o.logoPct / 100), Math.floor(cap / 1.18));
    var pad = o.logoPlate ? Math.min(Math.max(3, Math.round(side * 0.09)), Math.floor((cap - side) / 2)) : 0;
    return { side: side, pad: pad, x: Math.round(g.pad + g.offset + o.margin * g.mod + (area - side) / 2) };
  }

  /* ---------------------------------------------------------- canvas draw */
  function fillStyleFor(c, g, o) {
    if (o.grad === "linear") {
      var a = (o.angle % 360) * Math.PI / 180;
      var cx = g.width / 2, cy = g.height / 2, len = Math.max(g.width, g.height) / 2;
      var gd = ctx.createLinearGradient(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      gd.addColorStop(0, o.fg); gd.addColorStop(1, o.fg2); return gd;
    }
    if (o.grad === "radial") {
      var rg = ctx.createRadialGradient(g.width / 2, g.height / 2, 0, g.width / 2, g.height / 2, Math.max(g.width, g.height) / 1.6);
      rg.addColorStop(0, o.fg); rg.addColorStop(1, o.fg2); return rg;
    }
    return o.fg;
  }

  function drawToCanvas(c, qr, o) {
    var g = geometry(qr.getModuleCount(), o);
    canvas.width = g.width; canvas.height = g.height;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, g.width, g.height);

    /* frame */
    if (o.frame) {
      c.fillStyle = o.frameColor;
      c.fill(new Path2D(roundRectPath(0, 0, g.width, g.height, Math.round(g.size * 0.05))));
    }
    /* background panel */
    var pad = o.frame ? Math.round(g.pad * 0.55) : 0;
    if (!o.transparent) {
      c.fillStyle = o.bg;
      if (o.frame) c.fill(new Path2D(roundRectPath(pad, pad, g.size + (g.pad - pad) * 2, g.size + (g.pad - pad) * 2, Math.round(g.size * 0.035))));
      else c.fillRect(0, 0, g.width, g.height);
    }

    var paths = symbolPaths(qr, o, g);
    c.fillStyle = fillStyleFor(c, g, o);
    c.fill(new Path2D(paths.body));
    c.fillStyle = o.eyeColor;
    c.fill(new Path2D(paths.rings), "evenodd");
    c.fill(new Path2D(paths.balls));

    /* logo */
    if (state.logo) {
      var box = logoBox(g.count, g, o);
      var s = box.side, x = box.x;
      if (o.logoPlate) {
        c.fillStyle = o.transparent ? "#ffffff" : o.bg;
        c.fill(new Path2D(roundRectPath(x - box.pad, x - box.pad, s + box.pad * 2, s + box.pad * 2, Math.round(s * 0.16))));
      }
      var nw = state.logo.naturalWidth || s, nh = state.logo.naturalHeight || s;
      var scale = Math.min(s / nw, s / nh), w = nw * scale, h = nh * scale;
      c.drawImage(state.logo, x + (s - w) / 2, x + (s - h) / 2, w, h);
    }

    /* caption */
    if (o.frame && o.frameText) {
      var fam = o.frameFont === "serif" ? "Georgia, 'Times New Roman', serif" : (o.frameFont === "mono" ? "ui-monospace, Menlo, monospace" : "-apple-system, 'Segoe UI', Inter, sans-serif");
      var fs = Math.max(12, Math.round(g.band * 0.52));
      c.fillStyle = o.frameTextColor;
      c.font = "700 " + fs + "px " + fam;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(o.frameText.toUpperCase(), g.width / 2, g.pad + g.size + g.band / 2 + 1);
    }
    return g;
  }

  /* -------------------------------------------------------------- svg out */
  function toSvg(qr, o) {
    var g = geometry(qr.getModuleCount(), o);
    var paths = symbolPaths(qr, o, g);
    var fam = o.frameFont === "serif" ? "Georgia, 'Times New Roman', serif" : (o.frameFont === "mono" ? "monospace" : "-apple-system, 'Segoe UI', Inter, sans-serif");
    var fs = Math.max(12, Math.round(g.band * 0.52));
    var defs = "", fillAttr = o.fg, eyeFill = o.eyeColor;
    if (o.grad !== "none") {
      var grad;
      if (o.grad === "linear") {
        var a = (o.angle % 360) * Math.PI / 180;
        var x1 = 50 - Math.cos(a) * 50, y1 = 50 - Math.sin(a) * 50, x2 = 50 + Math.cos(a) * 50, y2 = 50 + Math.sin(a) * 50;
        grad = '<linearGradient id="csGrad" x1="' + x1.toFixed(2) + '%" y1="' + y1.toFixed(2) + '%" x2="' + x2.toFixed(2) + '%" y2="' + y2.toFixed(2) + '%">' +
          '<stop offset="0" stop-color="' + o.fg + '"/><stop offset="1" stop-color="' + o.fg2 + '"/></linearGradient>';
      } else {
        grad = '<radialGradient id="csGrad" cx="50%" cy="50%" r="62%">' +
          '<stop offset="0" stop-color="' + o.fg + '"/><stop offset="1" stop-color="' + o.fg2 + '"/></radialGradient>';
      }
      defs = "<defs>" + grad + "</defs>";
      fillAttr = "url(#csGrad)";
    }
    var s = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + g.width + '" height="' + g.height + '" viewBox="0 0 ' + g.width + " " + g.height + '" shape-rendering="geometricPrecision">' +
      defs;
    if (o.frame) s += '<rect width="' + g.width + '" height="' + g.height + '" rx="' + Math.round(g.size * 0.05) + '" fill="' + o.frameColor + '"/>';
    var pad = o.frame ? Math.round(g.pad * 0.55) : 0;
    if (!o.transparent) {
      if (o.frame) s += '<rect x="' + pad + '" y="' + pad + '" width="' + (g.size + (g.pad - pad) * 2) + '" height="' + (g.size + (g.pad - pad) * 2) + '" rx="' + Math.round(g.size * 0.035) + '" fill="' + o.bg + '"/>';
      else s += '<rect width="100%" height="100%" fill="' + o.bg + '"/>';
    }
    s += '<path d="' + paths.body + '" fill="' + fillAttr + '"/>';
    s += '<path d="' + paths.rings + '" fill="' + eyeFill + '" fill-rule="evenodd"/>';
    s += '<path d="' + paths.balls + '" fill="' + eyeFill + '"/>';
    if (state.logo && state.logoDataUrl) {
      var box = logoBox(g.count, g, o), sz = box.side, bx = box.x;
      if (o.logoPlate)
        s += '<rect x="' + (bx - box.pad) + '" y="' + (bx - box.pad) + '" width="' + (sz + box.pad * 2) + '" height="' + (sz + box.pad * 2) +
          '" rx="' + Math.round(sz * 0.16) + '" fill="' + (o.transparent ? "#ffffff" : o.bg) + '"/>';
      s += '<image x="' + bx + '" y="' + bx + '" width="' + sz + '" height="' + sz + '" href="' + state.logoDataUrl + '" preserveAspectRatio="xMidYMid meet"/>';
    }
    if (o.frame && o.frameText) {
      s += '<text x="' + (g.width / 2) + '" y="' + (g.pad + g.size + g.band / 2 + 1) + '" text-anchor="middle" dominant-baseline="middle" ' +
        'font-family="' + fam + '" font-weight="700" font-size="' + fs + '" fill="' + o.frameTextColor + '">' + esc(o.frameText.toUpperCase()) + "</text>";
    }
    s += "</svg>";
    return s;
  }

  /* -------------------------------------------------------------- PDF out */
  function jpegFromCanvas(cb) {
    if (canvas.toBlob) {
      canvas.toBlob(function (b) {
        if (!b) { cb(null); return; }
        var fr = new FileReader();
        fr.onload = function () { cb(new Uint8Array(fr.result)); };
        fr.readAsArrayBuffer(b);
      }, "image/jpeg", 0.95);
    } else {
      var bin = atob(canvas.toDataURL("image/jpeg", 0.95).split(",")[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      cb(arr);
    }
  }

  function buildPdf(jpeg, w, h) {
    var enc8 = function (s) { return new TextEncoder().encode(s); };
    var chunks = [], offsets = [], length = 0;
    function push(data) { var u = typeof data === "string" ? enc8(data) : data; chunks.push(u); length += u.length; }
    function obj(n, body) { offsets[n] = length; push(n + " 0 obj\n" + body + "\nendobj\n"); }

    push("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + w + " " + h + "] " +
      "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
    offsets[4] = length;
    push("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + w + " /Height " + h +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n");
    push(jpeg);
    push("\nendstream\nendobj\n");
    var content = "q\n" + w + " 0 0 " + h + " 0 0 cm\n/Im0 Do\nQ\n";
    obj(5, "<< /Length " + content.length + " >>\nstream\n" + content + "endstream");
    obj(6, "<< /Producer (Code Studio - JRiSpace) /Creator (Code Studio) >>");

    var xrefPos = length;
    var xref = "xref\n0 7\n0000000000 65535 f \n";
    for (var i = 1; i <= 6; i++) {
      var off = String(offsets[i] || 0);
      while (off.length < 10) off = "0" + off;
      xref += off + " 00000 n \n";
    }
    push(xref + "trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF\n");

    var out = new Uint8Array(length), p = 0;
    for (var k = 0; k < chunks.length; k++) { out.set(chunks[k], p); p += chunks[k].length; }
    return out;
  }

  /* ---------------------------------------------------------------- build */
  function clearPreview(o) {
    state.qr = null; state.payload = ""; state.dims = null;
    $("meta").textContent = "—";
    $("previewWrap").classList.toggle("transparent", !!(o && o.transparent));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!(o && o.transparent)) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    canvas.setAttribute("aria-label", "QR code preview: no encoded content");
    $("previewWrap").classList.add("empty");
    exportIds.forEach(function (id) { $(id).disabled = true; });
  }

  function build() {
    var o = styleOpts();
    $("err").textContent = "";
    var res = buildPayload();
    requiredMissing = res.missing;
    $("gradRow").hidden = o.grad === "none";
    $("angleWrap").style.visibility = o.grad === "linear" ? "visible" : "hidden";
    $("frameBody").hidden = !o.frame;

    if (res.missing.length || !res.payload) {
      clearPreview(o);
      if (res.missing.length && touched) $("err").textContent = T("err.missing", { list: res.missing.join(", ") });
      else if (res.missing.length) $("meta").textContent = "—";
      return;
    }
    try {
      var qr = qrcode(0, o.ecc);
      qr.addData(res.payload);
      qr.make();
      state.qr = qr; state.count = qr.getModuleCount(); state.payload = res.payload; state.type = state.type;
      var g = drawToCanvas(ctx, qr, o);
      state.dims = g;
      state.lastOpts = o;
      $("previewWrap").classList.remove("empty");
      canvas.setAttribute("aria-label", "QR code for " + state.type + ": " + res.payload.replace(/\s+/g, " ").slice(0, 140));
      exportIds.forEach(function (id) { $(id).disabled = false; });
      var v = (qr.getModuleCount() - 17) / 4;
      $("meta").innerHTML = "<span>v" + v + " · " + qr.getModuleCount() + "×" + qr.getModuleCount() + " " + T("meta.modules") + "</span>" +
        "<span>ECC " + o.ecc + "</span><span>" + g.width + "×" + g.height + " " + T("meta.px") + "</span>" +
        "<span>" + res.payload.length + " " + T("meta.chars") + "</span>";
      if (o.ecc !== "H" && state.logo) $("err").textContent = T("err.logoEcc");
    } catch (e) {
      clearPreview(o);
      $("err").textContent = T("err.encode", { msg: (e && e.message ? e.message : e) });
    }
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(build, 120); }

  /* -------------------------------------------------------------- exports */
  function updateLogoTxt(name) {
    $("logoTxt").innerHTML = name
      ? "<b>" + esc(name) + "</b>"
      : "<b>" + esc(T("lbl.logoChoose")) + "</b> — " + esc(T("lbl.logoFormats"));
  }

  function slug() {
    var base = (state.payload || "qr").replace(/^[a-z]+:/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return (state.type || "qr") + "-" + (base.slice(0, 40) || "code");
  }
  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function fresh() { clearTimeout(timer); build(); return !!state.qr; }

  $("dlPng").addEventListener("click", function () {
    if (!fresh()) return;
    canvas.toBlob(function (b) { if (b) download(b, slug() + ".png"); }, "image/png");
  });
  $("dlJpg").addEventListener("click", function () {
    if (!fresh()) return;
    canvas.toBlob(function (b) { if (b) download(b, slug() + ".jpg"); }, "image/jpeg", 0.95);
  });
  $("dlSvg").addEventListener("click", function () {
    if (!fresh()) return;
    download(new Blob([toSvg(state.qr, state.lastOpts)], { type: "image/svg+xml" }), slug() + ".svg");
  });
  $("dlPdf").addEventListener("click", function () {
    if (!fresh()) return;
    var g = state.dims;
    jpegFromCanvas(function (jpeg) {
      if (!jpeg) { $("err").textContent = T("err.pdf"); return; }
      download(new Blob([buildPdf(jpeg, g.width, g.height)], { type: "application/pdf" }), slug() + ".pdf");
    });
  });
  $("copyBtn").addEventListener("click", function () {
    if (!fresh()) return;
    canvas.toBlob(function (b) {
      if (!b || !navigator.clipboard || !window.ClipboardItem) {
        $("err").textContent = T("err.clipboard");
        return;
      }
      navigator.clipboard.write([new ClipboardItem({ "image/png": b })]).then(function () {
        $("meta").innerHTML = "<span>" + T("status.copied") + " ✓</span>";
      }).catch(function () { $("err").textContent = T("err.copyBlocked"); });
    }, "image/png");
  });

  /* ------------------------------------------------------------- controls */
  ["ecc", "size", "margin", "fg", "fg2", "bg", "gradMode", "gradAngle", "eyeColor",
   "transparent", "frameOn", "frameText", "frameFont", "frameColor", "frameTextColor",
   "logoPct", "logoPlate"].forEach(function (id) {
    var el = $(id);
    var ev = (el.type === "checkbox" || el.tagName === "SELECT") ? "change" : "input";
    el.addEventListener(ev, schedule);
    if (el.type === "number") el.addEventListener("change", schedule);
  });

  $("eyeAuto").addEventListener("click", function () {
    $("eyeColor").value = $("fg").value; build();
  });
  $("swapColors").addEventListener("click", function () {
    var a = $("fg").value; $("fg").value = $("bg").value; $("bg").value = a;
    $("eyeColor").value = $("fg").value; build();
  });
  $("presets").addEventListener("click", function (e) {
    var b = e.target.closest("[data-size]"); if (!b) return;
    $("size").value = b.getAttribute("data-size");
    Array.prototype.forEach.call($("presets").querySelectorAll(".preset"), function (p) {
      p.setAttribute("aria-pressed", String(p === b));
    });
    build();
  });
  $("size").addEventListener("input", function () {
    Array.prototype.forEach.call($("presets").querySelectorAll(".preset"), function (p) {
      p.setAttribute("aria-pressed", String(p.getAttribute("data-size") === $("size").value));
    });
  });

  /* logo */
  var LOGO_MAX_BYTES = 8 * 1024 * 1024;
  $("logo").addEventListener("change", function (e) {
    var token = ++state.logoToken;
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { $("err").textContent = T("err.image"); e.target.value = ""; return; }
    if (f.size > LOGO_MAX_BYTES) { $("err").textContent = T("err.image"); e.target.value = ""; return; }
    function fail() { if (token === state.logoToken) $("err").textContent = T("err.image"); }
    var rd = new FileReader();
    rd.onerror = fail;
    rd.onload = function () {
      if (token !== state.logoToken) return;
      var img = new Image();
      img.onerror = fail;
      img.onload = function () {
        if (token !== state.logoToken) return;
        state.logo = img; state.logoDataUrl = rd.result; state.logoName = f.name;
        if ($("ecc").value !== "H") $("ecc").value = "H";
        updateLogoTxt(f.name);
        build();
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
  $("clearLogo").addEventListener("click", function () {
    ++state.logoToken;
    state.logo = null; state.logoDataUrl = ""; state.logoName = "";
    $("logo").value = "";
    updateLogoTxt("");
    build();
  });

  /* tabs */
  function setTab(which) {
    var isContent = which === "content";
    $("tabBtnContent").setAttribute("aria-selected", String(isContent));
    $("tabBtnDesign").setAttribute("aria-selected", String(!isContent));
    $("panelContent").hidden = !isContent;
    $("panelDesign").hidden = isContent;
  }
  $("tabBtnContent").addEventListener("click", function () { setTab("content"); });
  $("tabBtnDesign").addEventListener("click", function () { setTab("design"); });

  /* theme */
  $("themeBtn").addEventListener("click", function () {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
    try { localStorage.setItem("qrs-theme", dark ? "light" : "dark"); } catch (e) {}
    buildStylePickers();
  });

  /* glow follows the pointer */
  var stage = $("previewWrap"), raf = null;
  if (window.matchMedia("(pointer:fine)").matches) {
    stage.addEventListener("pointermove", function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        var r = stage.getBoundingClientRect();
        stage.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
        stage.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
        raf = null;
      });
    });
  }

  /* status badge */
  var badge = $("statusBadge"), meta = $("meta");
  function syncBadge() {
    var txt = meta.textContent || "";
    var state_ = /^—/.test(txt) || txt === T("meta.fill") ? "empty" : "ready";
    if (txt.indexOf(T("status.copied")) === 0) state_ = "copied";
    badge.textContent = T("status." + state_);
  }
  new MutationObserver(syncBadge).observe(meta, { childList: true, characterData: true, subtree: true });


  /* ---------------------------------------------- whatsapp screening chat */
  var CHAT = (function () {
    var WA = "https://wa.me/50938248175";
    var transcript = [];        // {role:'bot'|'user'|'sys', key, vars, text}
    var step = 0, answers = {}, busy = false, finished = false;
    var STEPS = [
      { key: "name", ask: "chat.q1", type: "text", required: true },
      { key: "email", ask: "chat.q2", type: "email", required: true, withName: true },
      { key: "business", ask: "chat.q3", type: "text", required: false },
      { key: "sector", ask: "chat.q4", type: "choice", options: "s" },
      { key: "need", ask: "chat.q5", type: "choice", options: "n" }
    ];

    var overlay = $("chatOverlay"), body = $("chatBody"), input = $("chatText"),
        chips = $("chatChips"), stepLabel = $("chatStep"), bar = $("chatBar");

    function bubble(role, text) {
      var d = document.createElement("div");
      d.className = "msg " + role;
      d.innerHTML = esc(text).replace(/\n/g, "<br>");
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
      return d;
    }
    function typing() {
      var d = document.createElement("div");
      d.className = "typing";
      d.innerHTML = "<i></i><i></i><i></i>";
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
      return d;
    }
    function push(entry) {
      transcript.push(entry);
      if (entry.role === "bot") return bubble("bot", entry.text);
      if (entry.role === "user") return bubble("user", entry.text);
      return bubble("sys", entry.text);
    }

    function progress() {
      var done = Math.min(step, STEPS.length);
      stepLabel.textContent = T("chat.step", { n: Math.min(step + 1, STEPS.length), total: STEPS.length });
      bar.style.width = Math.round(done / STEPS.length * 100) + "%";
    }

    function askNext() {
      if (step >= STEPS.length) return finish();
      var s = STEPS[step];
      var vars = s.withName ? { name: (answers.name || "").split(" ")[0] || answers.name || "" } : null;
      var text = T(s.ask, vars);
      busy = true;
      var t = typing();
      setTimeout(function () {
        t.remove();
        push({ role: "bot", key: s.ask, vars: vars, text: text });
        busy = false;
        renderChips(s);
        progress();
        /* the chip tray shrinks the message list — keep the new question in view */
        requestAnimationFrame(function () { body.scrollTop = body.scrollHeight; });
        input.focus();
      }, 420);
    }

    function renderChips(s) {
      chips.innerHTML = "";
      if (!s || s.type !== "choice") return;
      var opts = [];
      for (var i = 1; i <= 8; i++) {
        var k = "chat." + s.options + i, v = T(k);
        if (v === k) break;
        opts.push(v);
      }
      opts.forEach(function (label) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = label;
        b.addEventListener("click", function () { answer(label); });
        chips.appendChild(b);
      });
    }

    function composeMessage() {
      var a = answers;
      var L = [];
      L.push("Hi! I'm coming from Code Studio.");
      L.push("");
      L.push("Name: " + (a.name || "—"));
      L.push("Email: " + (a.email || "—"));
      L.push("Business: " + (a.business || "—"));
      L.push("Sector: " + (a.sector || "—"));
      L.push("Need: " + (a.need || "—"));
      return L.join("\n");
    }

    function finish() {
      finished = true;
      var text = composeMessage();
      var box = document.createElement("div");
      box.className = "msg bot";
      box.style.maxWidth = "96%";
      box.innerHTML = '<div style="margin-bottom:8px">' + esc(T("chat.summary")) + "</div>" +
        '<div class="chat-summary">' + esc(text) + "</div>" +
        '<div class="chat-actions">' +
          '<a class="chat-btn go" id="chatOpen" href="' + WA + "?text=" + encodeURIComponent(text) + '" target="_blank" rel="noopener">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5a8.5 8.5 0 01-12.6 7.4L3.5 20.5l1.7-4.3A8.5 8.5 0 1120.5 11.5z"/></svg>' +
            esc(T("chat.open")) + "</a>" +
          '<button type="button" class="chat-btn" id="chatAgain">' + esc(T("chat.restart")) + "</button>" +
        "</div>";
      body.appendChild(box);
      body.scrollTop = body.scrollHeight;
      chips.innerHTML = "";
      input.disabled = true;
      stepLabel.textContent = T("chat.step", { n: STEPS.length, total: STEPS.length });
      bar.style.width = "100%";
      $("chatAgain").addEventListener("click", function () { reset(); });
      var open = $("chatOpen");
      open.addEventListener("click", function () { setTimeout(close, 400); });
    }

    function answer(value) {
      if (busy || finished) return;
      var s = STEPS[step];
      if (!s) return;
      var v = String(value == null ? "" : value)
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 300);
      if (s.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) {
        push({ role: "user", text: v });
        push({ role: "bot", text: T("chat.badEmail") });
        input.value = "";
        return;
      }
      if (s.required && !v) return;
      answers[s.key] = v || "—";
      input.value = "";
      push({ role: "user", text: v || T("chat.skip") });
      step++;
      askNext();
    }

    function reset() {
      transcript = []; answers = {}; step = 0; busy = false; finished = false;
      body.innerHTML = ""; chips.innerHTML = ""; input.disabled = false; input.value = "";
      push({ role: "bot", key: "chat.intro", text: T("chat.intro") });
      progress();
      askNext();
    }

    function open(presetNeed) {
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      reset();
      if (presetNeed) {
        setTimeout(function () {
          // pre-select the need when the visitor came from a service card
          answers.__preset = presetNeed;
        }, 0);
      }
      setTimeout(function () { input.focus(); }, 60);
    }
    function close() {
      overlay.hidden = true;
      document.body.style.overflow = "";
    }

    $("chatForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy || finished) return;
      answer(input.value);
    });
    $("chatClose").addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) close();
    });

    return {
      open: open, close: close, reset: reset,
      langChanged: function () {
        // re-render the transcript in the new language
        if (overlay.hidden) return;
        $("chatStatus").textContent = T("chat.status");
        input.placeholder = T("chat.ph");
        $("chatClose").setAttribute("aria-label", "Close");
        if (finished) return;
        body.innerHTML = "";
        transcript.forEach(function (m) {
          var text = m.key ? T(m.key, m.vars) : m.text;
          bubble(m.role, text);
        });
        var s = STEPS[Math.min(step, STEPS.length - 1)];
        renderChips(step < STEPS.length ? s : null);
        progress();
      },
      isOpen: function () { return !overlay.hidden; },
      answers: function () { return answers; },
      compose: composeMessage
    };
  })();

  function openChat() { CHAT.open(); }
  document.querySelectorAll(".promo .wa, #promoWaBtn").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); CHAT.open(); });
  });
  document.querySelectorAll(".svc a").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); CHAT.open(); });
  });

  /* ------------------------------------------------------------- bootstrap */
  /* language */
  function applyLang(code) {
    if (!window.CS || !CS.dict[code]) code = "en";
    if (window.CS) CS.apply(code);
    if (typeof CHAT !== "undefined") CHAT.langChanged();
    buildStylePickers();
    renderTypeGrid();
    renderFields();
    updateLogoTxt(state.logoName || "");
    syncBadge();
    build();
  }
  /* persist = the user chose it on purpose (switcher / ?lang=); auto-detection is not saved */
  function setLang(code, persist) {
    applyLang(code);
    if (persist !== false) {
      try { localStorage.setItem("cs-lang", window.CS ? CS.lang() : code); } catch (e) {}
    }
  }

  /* explicit ?lang= > saved choice > browser language > English */
  function detectLang(codes) {
    for (var i = 0; i < codes.length; i++) {
      var c = String(codes[i] || "").toLowerCase();
      var base = c.split("-")[0];
      if (window.CS && (CS.dict[c] || CS.dict[base])) return CS.dict[c] ? c : base;
    }
    return "en";
  }

  state.type = "link";
  form.link = { url: "" };
  if (location.hash === "#design") setTab("design");

  var savedLang = null, fromBrowser = false;
  try { savedLang = localStorage.getItem("cs-lang"); } catch (e) {}
  if (savedLang && !(window.CS && CS.dict[savedLang])) savedLang = null;
  /* ?lang=fr wins — makes a shareable link in any language */
  try {
    var qp = new URLSearchParams(location.search).get("lang");
    if (qp && window.CS && CS.dict[qp]) savedLang = qp;
  } catch (e) {}
  if (!savedLang) {
    var nav = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || "en"];
    savedLang = detectLang(nav);
    fromBrowser = true;
  }

  var langSel = $("langSelect");
  if (langSel && window.CS) {
    langSel.innerHTML = CS.langs().map(function (l) {
      return '<option value="' + l[0] + '"' + (l[0] === savedLang ? " selected" : "") + ">" + l[1] + "</option>";
    }).join("");
    langSel.value = savedLang;
    langSel.addEventListener("change", function () { setLang(langSel.value, true); });
  }
  if (window.CS) CS.apply(savedLang);

  /* chat chrome strings */
  $("chatStatus").textContent = T("chat.status");
  $("chatText").placeholder = T("chat.ph");

  renderTypeGrid();
  renderFields();
  buildStylePickers();
  updateLogoTxt("");
  syncBadge();
  build();

  window.__cs = {
    build: build, state: state, payloadFor: function () { return buildPayload(); },
    setType: function (t) { state.type = t; renderTypeGrid(); renderFields(); build(); },
    setField: function (k, v) { form[state.type][k] = v; renderFields(); build(); },
    svg: function () { return toSvg(state.qr, state.lastOpts); },
    types: TYPES,
    setLang: setLang,
    chat: CHAT,
    detectLang: detectLang,
    autoDetected: function () { return fromBrowser; },
    lang: function () { return window.CS ? CS.lang() : "en"; }
  };
})();
