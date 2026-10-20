/*
 * Loon: use an existing official Chinese subtitle in the English slot.
 * Only intended for the matching Crunchyroll iPhone playback metadata URL.
 * No translation service, local receiver, or account data export is required.
 */
(function () {
  "use strict";
  try {
    var options = typeof $argument === "object" && $argument ? $argument : {};
    if (options.source === "始终机翻" && options.machine_translation !== false) {
      $done({}); return;
    }
    if (typeof $response === "undefined" || $response.status !== 200 || typeof $response.body !== "string") {
      $done({}); return;
    }
    var playback = JSON.parse($response.body);
    var subtitles = playback && playback.subtitles;
    var english = subtitles && subtitles["en-US"];
    var preferred = subtitles && (subtitles["zh-CN"] || subtitles["zh-HK"]);
    if (!english || !preferred || !/^https:\/\//i.test(preferred.url || "") || !/^(ass|ssa|vtt|webvtt)$/i.test(preferred.format || "")) {
      $done({}); return;
    }
    english.url = preferred.url;
    english.format = preferred.format;
    $done({body: JSON.stringify(playback)});
  } catch (_) { $done({}); }
})();
