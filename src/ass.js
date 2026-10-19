var CrunchyrollASS = (function () {
  "use strict";

  function parse(body) {
    var newline = body.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
    var lines = body.split(/\r?\n/);
    var section = "";
    var fields = [];
    var events = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var heading = line.replace(/^\uFEFF/, "").match(/^\s*\[([^\]]+)\]\s*$/);
      if (heading) { section = heading[1].toLowerCase(); continue; }
      if (section !== "events") continue;
      var format = line.match(/^\s*Format\s*:\s*(.*)$/i);
      if (format) {
        fields = format[1].split(",").map(function (field) { return field.trim().toLowerCase(); });
        continue;
      }
      var dialogue = line.match(/^\s*Dialogue\s*:\s*/i);
      if (!dialogue || !fields.length || fields[fields.length - 1] !== "text") continue;
      var start = dialogue[0].length;
      var position = start;
      var valid = true;
      for (var column = 0; column < fields.length - 1; column++) {
        var comma = line.indexOf(",", position);
        if (comma < 0) { valid = false; break; }
        position = comma + 1;
      }
      if (!valid) continue;
      var text = line.slice(position);
      // Vector drawings and karaoke need their own layout/animation treatment.
      if (/{[^}]*\\p[1-9]/i.test(text) || /\\(?:k[fo]?|K)\d+/.test(text)) continue;
      var tags = text.match(/{[^}]*}/g) || [];
      var plain = text.replace(/{[^}]*}/g, "").replace(/\\[Nn]/g, " ").replace(/\\h/g, " ").trim();
      if (!/[a-z]/i.test(plain) || plain.length > 800) continue;
      events.push({line: i, prefix: line.slice(0, position), text: text, plain: plain, tags: tags.join("")});
    }
    return {lines: lines, newline: newline, events: events};
  }

  function safeText(value) {
    return String(value).replace(/\u0000/g, "").replace(/\\/g, "＼").replace(/{/g, "｛").replace(/}/g, "｝").replace(/\r\n?|\n/g, "\\N");
  }

  function render(document, translations, bilingual) {
    var lines = document.lines.slice();
    var changed = 0;
    document.events.forEach(function (event) {
      var translated = translations[event.plain];
      if (typeof translated !== "string" || !translated.trim() || translated === event.plain) return;
      var chinese = safeText(translated.trim());
      var text = bilingual ? event.text + "\\N{\\r}" + chinese : event.tags + chinese;
      lines[event.line] = event.prefix + text;
      changed++;
    });
    return {body: lines.join(document.newline), changed: changed};
  }

  function batches(texts, maximumEncodedLength, maximumRows) {
    var result = [];
    var batch = [];
    var size = 0;
    texts.forEach(function (text) {
      var encoded;
      try { encoded = encodeURIComponent(text).length; } catch (_) { return; }
      if (encoded > maximumEncodedLength) return;
      if (batch.length && (size + encoded + 3 > maximumEncodedLength || batch.length >= maximumRows)) {
        result.push(batch); batch = []; size = 0;
      }
      batch.push(text);
      size += encoded + 3;
    });
    if (batch.length) result.push(batch);
    return result;
  }

  function decodeGoogle(body, expectedRows) {
    var parsed = JSON.parse(body);
    var text;
    if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
      text = parsed[0].map(function (part) { return part && typeof part[0] === "string" ? part[0] : ""; }).join("");
    } else if (Array.isArray(parsed) && typeof parsed[0] === "string") {
      text = parsed.join("");
    } else if (parsed && Array.isArray(parsed.sentences)) {
      text = parsed.sentences.map(function (part) { return part.trans || ""; }).join("");
    } else { throw new Error("Unsupported translation response"); }
    var rows = text.split(/\r\n?|\n/);
    if (rows.length !== expectedRows || rows.some(function (row) { return !row.trim(); })) {
      throw new Error("Translation row count mismatch");
    }
    return rows;
  }

  function cacheKey(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "t" + (hash >>> 0).toString(16) + ":" + text.length;
  }

  return {parse: parse, render: render, batches: batches, decodeGoogle: decodeGoogle, cacheKey: cacheKey};
})();
