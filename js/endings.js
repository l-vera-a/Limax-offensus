/**
 * Матрица концовок — раздел 2 проектного документа.
 * Чистая функция: (boevoyDukh, prodvizhenie, failed) -> id концовки из data/game.json#endings.
 * Работает и в браузере (window.GameEndings), и в Node (module.exports) — один источник истины
 * для движка игры и для Monte Carlo симулятора.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GameEndings = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function resolveEnding(boevoyDukh, prodvizhenie, failed) {
    if (failed) return "fail";

    if (boevoyDukh > 150 && prodvizhenie > 150) return "reabilitation";
    if (boevoyDukh > 100 && prodvizhenie < 30) return "good-person";
    if (boevoyDukh < 0 && prodvizhenie > 80) return "results-no-friends";
    if (boevoyDukh > 50 && prodvizhenie > 80) return "strong-leader";
    if (boevoyDukh < -50 && prodvizhenie < 20) return "rainy-season";

    // Средняя зона — ничего из явных порогов не совпало.
    if (prodvizhenie >= 80) return "strong-leader";
    if (boevoyDukh < -30) return "rainy-season";
    return "strong-leader";
  }

  return { resolveEnding: resolveEnding };
});
