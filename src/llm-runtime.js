function CrunchyrollTranslateWithLLM(args) {
  "use strict";
  var settings = CrunchyrollLLM.config(args);
  if (!settings || typeof $httpClient === "undefined" || typeof $httpClient.post !== "function") return false;
  var completed = false;
  var timer;
  var document;
  var results = Object.create(null);
  var modelCache = {};
  var googleCache = {};
  var modelDirty = false;
  var googleDirty = false;
  var modelStorage = "Crunchyroll.Translate.LLM.zh-CN.v1";
  var googleStorage = "Crunchyroll.Translate.Google.zh-CN.v1";
  var deadline = Date.now() + settings.budget;
  var allowModel = true;

  function read(key) {
    try {
      if (typeof $persistentStore === "undefined") return {};
      var value = JSON.parse($persistentStore.read(key) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  function save(value, key, limit) {
    try {
      if (typeof $persistentStore === "undefined") return;
      var keys = Object.keys(value).filter(function (name) { return value[name] && typeof value[name] === "object"; }).sort(function (a, b) { return (value[b].at || 0) - (value[a].at || 0); }).slice(0, limit);
      var bounded = {};
      keys.forEach(function (name) { bounded[name] = value[name]; });
      $persistentStore.write(JSON.stringify(bounded), key);
    } catch (_) { /* Cache failure does not block playback. */ }
  }
  function finish() {
    if (completed) return;
    completed = true;
    if (timer) clearTimeout(timer);
    if (modelDirty) save(modelCache, modelStorage, 40);
    if (googleDirty) save(googleCache, googleStorage, 600);
    try {
      var rendered = document ? CrunchyrollASS.renderById(document, results, args.display === "中英双语") : null;
      $done(rendered && rendered.changed ? {body: rendered.body} : {});
    } catch (_) { $done({}); }
  }

  try {
    if (typeof $response === "undefined" || $response.status !== 200 || typeof $response.body !== "string" || $response.body.length > 1024 * 1024) {
      finish(); return true;
    }
    document = CrunchyrollASS.parse($response.body);
    modelCache = read(modelStorage);
    googleCache = read(googleStorage);
    var queue = [];
    CrunchyrollLLM.jobs(document).forEach(function (job) {
      job.fingerprint = CrunchyrollLLM.fingerprint(job, settings);
      job.cacheKey = CrunchyrollASS.cacheKey(job.fingerprint);
      var cached = modelCache[job.cacheKey];
      if (cached && cached.fingerprint === job.fingerprint) {
        try {
          var translated = CrunchyrollLLM.validate(cached.translations, job.entries);
          job.entries.forEach(function (entry) { results[entry.id] = translated[entry.id]; });
          return;
        } catch (_) { /* Retry invalid cache entries. */ }
      }
      queue.push(job);
    });
    if (!queue.length) { finish(); return true; }
    var active = 0;
    var next = 0;
    timer = setTimeout(finish, settings.budget);

    function pump() {
      if (completed) return;
      while (!completed && active < 2 && next < queue.length) {
        var job = queue[next++];
        active++;
        translate(job);
      }
      if (!active && next >= queue.length) finish();
    }
    function completeJob() {
      if (completed) return;
      active--;
      pump();
    }
    function translate(job) {
      var remaining = deadline - Date.now();
      if (!allowModel || remaining < 1500) { google(job); return; }
      var request = CrunchyrollLLM.request(job, settings, Math.max(500, Math.min(25000, remaining - 1000)));
      try {
        $httpClient.post(request, function (error, response, body) {
          if (completed) return;
          if (!error && response && response.status === 200) {
            try {
              var translated = CrunchyrollLLM.decode(body, job.entries);
              job.entries.forEach(function (entry) { results[entry.id] = translated[entry.id]; });
              modelCache[job.cacheKey] = {fingerprint: job.fingerprint, translations: translated, at: Date.now()};
              modelDirty = true;
              completeJob(); return;
            } catch (_) { /* Reject missing IDs and incomplete output. */ }
          }
          // Avoid repeatedly charging or retrying a misconfigured provider.
          allowModel = false;
          google(job);
        });
      } catch (_) { allowModel = false; google(job); }
    }
    function google(job) {
      if (completed) return;
      var texts = [];
      var seen = Object.create(null);
      var translated = Object.create(null);
      job.entries.forEach(function (entry) {
        var cached = googleCache[CrunchyrollASS.cacheKey(entry.plain)];
        if (cached && cached.source === entry.plain && typeof cached.translated === "string" && cached.translated.trim()) {
          results[entry.id] = cached.translated;
        } else if (!seen[entry.plain]) { seen[entry.plain] = true; texts.push(entry.plain); }
      });
      var batches = CrunchyrollASS.batches(texts, 6000, 50);
      var index = 0;
      function advance() {
        if (completed) return;
        if (index >= batches.length || deadline - Date.now() < 300 || typeof $httpClient.get !== "function") {
          job.entries.forEach(function (entry) { if (translated[entry.plain]) results[entry.id] = translated[entry.plain]; });
          completeJob(); return;
        }
        var batch = batches[index++];
        try {
          $httpClient.get({
            url: "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=en&tl=zh-CN&q=" + encodeURIComponent(batch.join("\r")),
            timeout: Math.max(300, Math.min(4000, deadline - Date.now())),
            "auto-cookie": false, headers: {Accept: "application/json"}
          }, function (error, response, body) {
            if (completed) return;
            if (!error && response && response.status === 200) {
              try {
                var values = CrunchyrollASS.decodeGoogle(body, batch.length);
                batch.forEach(function (source, i) {
                  translated[source] = values[i];
                  googleCache[CrunchyrollASS.cacheKey(source)] = {source: source, translated: values[i], at: Date.now()};
                });
                job.entries.forEach(function (entry) { if (translated[entry.plain]) results[entry.id] = translated[entry.plain]; });
                googleDirty = true;
              } catch (_) { /* Invalid fallback output remains English. */ }
            }
            advance();
          });
        } catch (_) { advance(); }
      }
      advance();
    }
    pump();
  } catch (_) { finish(); }
  return true;
}
