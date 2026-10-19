(function () {
  "use strict";
  var completed = false;
  var timer;
  var document;
  var translations = Object.create(null);
  var cache = {};
  var cacheChanged = false;
  var args = typeof $argument === "object" && $argument ? $argument : {};
  var bilingual = args.display === "中英双语";
  var storageKey = "Crunchyroll.Translate.Google.zh-CN.v1";

  function finish() {
    if (completed) return;
    completed = true;
    if (timer) clearTimeout(timer);
    if (cacheChanged && typeof $persistentStore !== "undefined") {
      try {
        var keys = Object.keys(cache).filter(function (key) {
          var entry = cache[key];
          return entry && typeof entry.source === "string" && typeof entry.translated === "string";
        }).sort(function (a, b) { return cache[b].at - cache[a].at; }).slice(0, 600);
        var bounded = {};
        keys.forEach(function (key) { bounded[key] = cache[key]; });
        $persistentStore.write(JSON.stringify(bounded), storageKey);
      } catch (_) { /* Cache failure must not prevent subtitles. */ }
    }
    try {
      var result = document ? CrunchyrollASS.render(document, translations, bilingual) : null;
      $done(result && result.changed ? {body: result.body} : {});
    } catch (_) { $done({}); }
  }

  try {
    if (typeof $response === "undefined" || $response.status !== 200 || typeof $response.body !== "string" || $response.body.length > 1024 * 1024) {
      finish(); return;
    }
    document = CrunchyrollASS.parse($response.body);
    if (!document.events.length) { finish(); return; }
    try {
      if (typeof $persistentStore !== "undefined") {
        var saved = JSON.parse($persistentStore.read(storageKey) || "{}");
        if (saved && typeof saved === "object" && !Array.isArray(saved)) cache = saved;
      }
    } catch (_) { cache = {}; }
    var seen = Object.create(null);
    var missing = [];
    document.events.forEach(function (event) {
      if (seen[event.plain]) return;
      seen[event.plain] = true;
      var cached = cache[CrunchyrollASS.cacheKey(event.plain)];
      // Compare the original text as well as the hash to avoid cache collisions.
      if (cached && cached.source === event.plain && typeof cached.translated === "string" && cached.translated.trim()) {
        translations[event.plain] = cached.translated;
      } else { missing.push(event.plain); }
    });
    var queue = CrunchyrollASS.batches(missing, 6000, 50);
    if (!queue.length) { finish(); return; }
    if (typeof $httpClient === "undefined") { finish(); return; }
    var active = 0;
    var next = 0;
    var stopped = false;
    timer = setTimeout(finish, 12000);

    function pump() {
      if (completed) return;
      while (!stopped && active < 3 && next < queue.length) {
        var batch = queue[next++];
        active++;
        translate(batch);
      }
      if (!active && (stopped || next >= queue.length)) finish();
    }
    function translate(batch) {
      var request = {
        url: "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=en&tl=zh-CN&q=" + encodeURIComponent(batch.join("\r")),
        timeout: 4000,
        "auto-cookie": false,
        headers: {Accept: "application/json"}
      };
      try {
        $httpClient.get(request, function (error, response, body) {
          if (completed) return;
          active--;
          if (response && response.status === 429) stopped = true;
          if (!error && response && response.status === 200) {
            try {
              var result = CrunchyrollASS.decodeGoogle(body, batch.length);
              batch.forEach(function (source, index) {
                translations[source] = result[index];
                cache[CrunchyrollASS.cacheKey(source)] = {source: source, translated: result[index], at: Date.now()};
              });
              cacheChanged = true;
            } catch (_) { /* A mismatched batch stays in English. */ }
          }
          pump();
        });
      } catch (_) { active--; pump(); }
    }
    pump();
  } catch (_) { finish(); }
})();
