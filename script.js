(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Небольшие UI-строки, которых нет в data/game.json (не нарратив, а
  // техническая обвязка — кнопки сброса/навигации, звук, статистика партий).
  // ---------------------------------------------------------------------
  var EXTRA_UI = {
    ru: {
      continueButtonDay: "Продолжить экспедицию (День {n} из {total})",
      restartLink: "Начать заново",
      restartConfirm: "Текущий прогресс партии будет стёрт. Начать заново?",
      playedCount: "Сыграно партий: ",
      bestEnding: ". Лучшая концовка: ",
      journalBack: "Назад",
      journalHeading: "Журнал экспедиции",
      muteLabel: "Выключить звук",
      unmuteLabel: "Включить звук",
      workedTag: "сработало",
      failedDayLabel: "День {n} — провал экспедиции",
      dayLabel: "День {n}",
      downloadCardFallback: "Скачать не удалось — попробуйте другой браузер.",
      teamPrevLabel: "Предыдущий участник",
      teamNextLabel: "Следующий участник",
      statBdLabel: "Дух",
      statProdLabel: "Прогресс",
      dayOfTotal: "из {total}",
      artifactLabel: "Артефакт дня"
    },
    uk: {
      continueButtonDay: "Продовжити експедицію (День {n} з {total})",
      restartLink: "Почати заново",
      restartConfirm: "Поточний прогрес партії буде стерто. Почати заново?",
      playedCount: "Зіграно партій: ",
      bestEnding: ". Найкраща кінцівка: ",
      journalBack: "Назад",
      journalHeading: "Журнал експедиції",
      muteLabel: "Вимкнути звук",
      unmuteLabel: "Увімкнути звук",
      workedTag: "спрацювало",
      failedDayLabel: "День {n} — провал експедиції",
      dayLabel: "День {n}",
      downloadCardFallback: "Не вдалося завантажити — спробуйте інший браузер.",
      teamPrevLabel: "Попередній учасник",
      teamNextLabel: "Наступний учасник",
      statBdLabel: "Дух",
      statProdLabel: "Прогрес",
      dayOfTotal: "з {total}",
      artifactLabel: "Артефакт дня"
    }
  };

  var ENDING_RANK = {
    "reabilitation": 6,
    "strong-leader": 5,
    "good-person": 4,
    "results-no-friends": 3,
    "rainy-season": 2,
    "fail": 1
  };

  var STORAGE_LANG = "limaxOffensus.lang";
  var STORAGE_MUTED = "limaxOffensus.muted";
  var STORAGE_PROGRESS = "limaxOffensus.progress";
  var STORAGE_HISTORY = "limaxOffensus.history";

  var game = null;
  var state = {
    lang: null,
    boevoyDukh: 0,
    prodvizhenie: 0,
    dayIndex: 0,
    history: [],
    failed: false,
    endingId: null,
    teamIndex: 0
  };

  var els = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheElements();
    bindStaticEvents();
    initAudio();
    fetch("data/game.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        game = data;
        boot();
      })
      .catch(function (err) {
        document.body.innerHTML = "<p style='padding:2rem'>Не удалось загрузить data/game.json: " + err + "</p>";
      });
  });

  function cacheElements() {
    [
      "mute-toggle",
      "screen-title", "latin-title", "lang-switch", "title-reveal", "subtitle-text",
      "played-count-line", "start-button", "reset-button",
      "screen-mission", "mission-text", "disclaimer-text", "meet-team-button",
      "screen-team", "team-viewport", "team-track", "team-prev", "team-next", "team-dots", "go-button",
      "screen-day", "stat-bd-label", "stat-bd-value", "stat-prod-label", "stat-prod-value",
      "day-counter", "day-counter-number", "day-counter-total", "day-scene",
      "day-body", "day-situation", "day-options",
      "outcome-body", "outcome-text", "delta-bd", "delta-prod", "luck-note",
      "outcome-artifact-name", "outcome-artifact-note", "next-button",
      "screen-final", "final-image", "final-reveal", "final-emoji", "final-title", "final-text",
      "final-bd-value", "final-prod-value",
      "download-card-button", "view-journal-button", "play-again-button", "card-canvas",
      "screen-journal", "journal-heading", "journal-list", "journal-back-button",
      "audio-ambient", "audio-click", "audio-stat-up", "audio-stat-down", "audio-fail"
    ].forEach(function (id) {
      els[toCamel(id)] = document.getElementById(id);
    });
  }

  function toCamel(id) {
    return id.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  // ---------------------------------------------------------------------
  // Загрузка/сохранение состояния
  // ---------------------------------------------------------------------

  function boot() {
    state.lang = localStorage.getItem(STORAGE_LANG);
    bindTitleEvents();
    renderTitleScreen();
    showScreen("title");
  }

  function loadJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_PROGRESS, JSON.stringify({
      boevoyDukh: state.boevoyDukh,
      prodvizhenie: state.prodvizhenie,
      dayIndex: state.dayIndex,
      history: state.history
    }));
  }

  function clearProgress() {
    localStorage.removeItem(STORAGE_PROGRESS);
  }

  function pushMatchHistory(record) {
    var history = loadJSON(STORAGE_HISTORY) || [];
    history.push(record);
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
  }

  // ---------------------------------------------------------------------
  // i18n
  // ---------------------------------------------------------------------

  function t(entry) {
    if (entry == null) return "";
    if (typeof entry === "string") return entry;
    return entry[state.lang] || entry.ru || "";
  }

  function tx(key) {
    return EXTRA_UI[state.lang][key];
  }

  function format(str, params) {
    return str.replace(/\{(\w+)\}/g, function (_, k) { return params[k]; });
  }

  // ---------------------------------------------------------------------
  // Экран 1 — Титул
  // ---------------------------------------------------------------------

  function renderTitleScreen() {
    els.langSwitch.querySelectorAll(".lang-button").forEach(function (btn) {
      btn.classList.toggle("is-selected", btn.dataset.lang === state.lang);
    });
    els.titleReveal.hidden = !state.lang;
    if (state.lang) revealTitleAfterLang();
  }

  function bindTitleEvents() {
    els.langSwitch.querySelectorAll(".lang-button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        playClick();
        setLang(btn.dataset.lang);
      });
    });

    els.startButton.addEventListener("click", function () {
      playClick();
      unlockAmbient();
      var progress = loadJSON(STORAGE_PROGRESS);
      if (progress) {
        resumeFromProgress(progress);
      } else {
        showScreen("mission");
        renderMissionScreen();
      }
    });

    els.resetButton.addEventListener("click", function () {
      playClick();
      if (window.confirm(tx("restartConfirm"))) {
        clearProgress();
        renderTitleScreen();
      }
    });
  }

  function setLang(lang) {
    state.lang = lang;
    localStorage.setItem(STORAGE_LANG, lang);
    els.langSwitch.querySelectorAll(".lang-button").forEach(function (btn) {
      btn.classList.toggle("is-selected", btn.dataset.lang === lang);
    });
    updateMuteButton();
    revealTitleAfterLang();
  }

  function revealTitleAfterLang() {
    els.titleReveal.hidden = false;
    els.subtitleText.textContent = t(game.ui.subtitle);

    var progress = loadJSON(STORAGE_PROGRESS);
    if (progress) {
      els.startButton.textContent = format(tx("continueButtonDay"), { n: progress.dayIndex + 1, total: game.days.length });
      els.resetButton.textContent = tx("restartLink");
      els.resetButton.hidden = false;
    } else {
      els.startButton.textContent = t(game.ui.startButton);
      els.resetButton.hidden = true;
    }

    var matchHistory = loadJSON(STORAGE_HISTORY) || [];
    if (matchHistory.length) {
      var best = matchHistory.reduce(function (a, b) {
        return (ENDING_RANK[b.endingId] || 0) > (ENDING_RANK[a.endingId] || 0) ? b : a;
      });
      var bestEnding = findEnding(best.endingId);
      els.playedCountLine.textContent = tx("playedCount") + matchHistory.length +
        (bestEnding ? tx("bestEnding") + t(bestEnding.title) : "");
    } else {
      els.playedCountLine.textContent = "";
    }
  }

  function findEnding(id) {
    for (var i = 0; i < game.endings.length; i++) {
      if (game.endings[i].id === id) return game.endings[i];
    }
    return null;
  }

  function resumeFromProgress(progress) {
    state.boevoyDukh = progress.boevoyDukh;
    state.prodvizhenie = progress.prodvizhenie;
    state.dayIndex = progress.dayIndex;
    state.history = progress.history;
    state.failed = false;
    showScreen("day");
    renderDayScreen(false);
  }

  // ---------------------------------------------------------------------
  // Экран 2 — Миссия
  // ---------------------------------------------------------------------

  function renderMissionScreen() {
    els.missionText.textContent = t(game.ui.mission);
    els.disclaimerText.textContent = t(game.ui.disclaimer);
    els.meetTeamButton.textContent = t(game.ui.meetTeamButton);
  }

  // ---------------------------------------------------------------------
  // Экран 3 — Команда
  // ---------------------------------------------------------------------

  function renderTeamScreen() {
    state.teamIndex = 0;
    els.teamTrack.innerHTML = "";
    els.teamDots.innerHTML = "";
    game.characters.forEach(function (ch) {
      var card = document.createElement("div");
      card.className = "team-card";
      card.innerHTML =
        '<img class="team-portrait" src="' + ch.portrait + '" alt="" loading="lazy">' +
        '<h3 class="team-name"></h3>' +
        '<p class="team-role"></p>' +
        '<p class="team-bio"></p>';
      card.querySelector(".team-name").textContent = t(ch.name);
      card.querySelector(".team-role").textContent = t(ch.role);
      card.querySelector(".team-bio").textContent = t(ch.bio);
      els.teamTrack.appendChild(card);

      var dot = document.createElement("span");
      dot.className = "team-dot";
      els.teamDots.appendChild(dot);
    });
    els.teamPrev.setAttribute("aria-label", tx("teamPrevLabel"));
    els.teamNext.setAttribute("aria-label", tx("teamNextLabel"));
    els.goButton.textContent = t(game.ui.goButton);
    updateTeamCarousel();
  }

  function updateTeamCarousel() {
    els.teamTrack.style.transform = "translateX(-" + (state.teamIndex * 100) + "%)";
    els.teamDots.querySelectorAll(".team-dot").forEach(function (dot, i) {
      dot.classList.toggle("is-active", i === state.teamIndex);
    });
    els.teamPrev.disabled = state.teamIndex === 0;
    els.teamNext.disabled = state.teamIndex === game.characters.length - 1;
  }

  function goToTeamSlide(index) {
    state.teamIndex = Math.max(0, Math.min(game.characters.length - 1, index));
    updateTeamCarousel();
  }

  function bindTeamCarouselEvents() {
    els.teamPrev.addEventListener("click", function () {
      playClick();
      goToTeamSlide(state.teamIndex - 1);
    });
    els.teamNext.addEventListener("click", function () {
      playClick();
      goToTeamSlide(state.teamIndex + 1);
    });

    var startX = null;
    var startY = null;
    var dragging = false;

    els.teamViewport.addEventListener("pointerdown", function (e) {
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;
    });
    els.teamViewport.addEventListener("pointerup", function (e) {
      if (!dragging) return;
      dragging = false;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        goToTeamSlide(state.teamIndex + (dx < 0 ? 1 : -1));
      }
    });
    els.teamViewport.addEventListener("pointercancel", function () {
      dragging = false;
    });
  }

  // ---------------------------------------------------------------------
  // Экраны 4/5 — День и Исход
  // ---------------------------------------------------------------------

  function currentDay() {
    return game.days[state.dayIndex];
  }

  function renderDayScreen(animateStats) {
    var day = currentDay();

    els.dayCounterNumber.textContent = day.day;
    els.dayCounterTotal.textContent = format(tx("dayOfTotal"), { total: game.days.length });
    els.dayCounter.setAttribute("aria-label", format(t(game.ui.dayCounter), { n: day.day }));
    els.dayScene.src = day.scene;
    els.dayScene.alt = t(day.title);
    els.daySituation.textContent = t(day.situation);

    els.statBdLabel.textContent = tx("statBdLabel");
    els.statProdLabel.textContent = tx("statProdLabel");
    setStatDisplay(els.statBdValue, state.boevoyDukh, animateStats);
    setStatDisplay(els.statProdValue, state.prodvizhenie, animateStats);

    els.dayOptions.innerHTML = "";
    day.options.forEach(function (option) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-button";
      btn.textContent = t(option.text);
      btn.addEventListener("click", function () {
        playClick();
        chooseOption(day, option);
      });
      els.dayOptions.appendChild(btn);
    });

    els.dayBody.hidden = false;
    els.outcomeBody.hidden = true;
  }

  function pickOutcome(option) {
    var total = option.outcomes.reduce(function (s, o) { return s + o.chance; }, 0);
    var roll = Math.random() * total;
    for (var i = 0; i < option.outcomes.length; i++) {
      var outcome = option.outcomes[i];
      if (roll < outcome.chance) return outcome;
      roll -= outcome.chance;
    }
    return option.outcomes[option.outcomes.length - 1];
  }

  function chooseOption(day, option) {
    var outcome = pickOutcome(option);

    state.boevoyDukh += outcome.boevoyDukh;
    state.prodvizhenie += outcome.prodvizhenie;
    state.history.push({
      day: day.day,
      dayTitle: day.title,
      dayPrinciple: day.principle,
      daySituation: day.situation,
      dayArtifact: day.artifact,
      dayArtifactNote: day.artifactNote,
      optionId: option.id,
      optionText: option.text,
      outcomeText: outcome.text,
      boevoyDukh: outcome.boevoyDukh,
      prodvizhenie: outcome.prodvizhenie,
      luck: !!outcome.luck,
      fail: !!outcome.fail
    });
    state.failed = !!outcome.fail;

    saveProgress();
    renderOutcome(day, outcome);
  }

  function renderOutcome(day, outcome) {
    els.outcomeText.textContent = t(outcome.text);
    setDelta(els.deltaBd, outcome.boevoyDukh);
    setDelta(els.deltaProd, outcome.prodvizhenie);

    els.outcomeArtifactName.textContent = tx("artifactLabel") + ": " + t(day.artifact);
    els.outcomeArtifactNote.textContent = t(day.artifactNote);

    els.luckNote.hidden = !outcome.luck;
    if (outcome.luck) els.luckNote.textContent = "🍀 " + t(game.ui.luckTag);

    setStatDisplay(els.statBdValue, state.boevoyDukh, true);
    setStatDisplay(els.statProdValue, state.prodvizhenie, true);

    if (outcome.boevoyDukh > 0 || outcome.prodvizhenie > 0) playSfx(els.audioStatUp);
    if (outcome.boevoyDukh < 0 || outcome.prodvizhenie < 0) playSfx(els.audioStatDown);
    if (outcome.fail) playSfx(els.audioFail);

    els.nextButton.textContent = t(game.ui.nextButton);
    els.dayBody.hidden = true;
    els.outcomeBody.hidden = false;
  }

  function setDelta(el, value) {
    el.textContent = (value > 0 ? "+" : "") + value;
    el.classList.remove("delta-up", "delta-down", "delta-zero");
    el.classList.add(value > 0 ? "delta-up" : value < 0 ? "delta-down" : "delta-zero");
  }

  function bindNextButton() {
    els.nextButton.addEventListener("click", function () {
      playClick();
      advanceAfterOutcome();
    });
  }

  function advanceAfterOutcome() {
    if (state.failed) {
      finalizeGame();
      return;
    }
    if (state.dayIndex >= game.days.length - 1) {
      finalizeGame();
      return;
    }
    state.dayIndex += 1;
    saveProgress();
    showScreen("day");
    renderDayScreen(false);
  }

  // ---------------------------------------------------------------------
  // Экран 6 — Финал
  // ---------------------------------------------------------------------

  function finalizeGame() {
    state.endingId = window.GameEndings.resolveEnding(state.boevoyDukh, state.prodvizhenie, state.failed);
    pushMatchHistory({
      date: new Date().toISOString(),
      endingId: state.endingId,
      boevoyDukh: state.boevoyDukh,
      prodvizhenie: state.prodvizhenie
    });
    clearProgress();
    showScreen("final");
    renderFinalScreen();
  }

  function renderFinalScreen() {
    var ending = findEnding(state.endingId);
    els.finalImage.src = ending.image;
    els.finalImage.alt = t(ending.title);
    els.finalReveal.hidden = ending.id === "fail";
    els.finalEmoji.textContent = ending.emoji;
    els.finalTitle.textContent = t(ending.title);
    els.finalText.textContent = t(ending.text);
    setStatDisplay(els.finalBdValue, state.boevoyDukh, false);
    setStatDisplay(els.finalProdValue, state.prodvizhenie, false);

    els.downloadCardButton.textContent = t(game.ui.downloadCardButton);
    els.viewJournalButton.textContent = t(game.ui.journalButton);
    els.playAgainButton.textContent = t(game.ui.playAgainButton);
  }

  function resetGameState() {
    state.boevoyDukh = 0;
    state.prodvizhenie = 0;
    state.dayIndex = 0;
    state.history = [];
    state.failed = false;
    state.endingId = null;
  }

  // ---------------------------------------------------------------------
  // Экран 7 — Журнал
  // ---------------------------------------------------------------------

  function renderJournalScreen() {
    els.journalHeading.textContent = tx("journalHeading");
    els.journalBackButton.textContent = tx("journalBack");
    els.journalList.innerHTML = "";

    state.history.forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "journal-entry";

      var dayLabel = entry.fail
        ? format(tx("failedDayLabel"), { n: entry.day })
        : format(tx("dayLabel"), { n: entry.day });

      var luckTag = entry.luck
        ? "🍀 " + t(game.ui.luckTag)
        : "✅ " + tx("workedTag");

      item.innerHTML =
        '<h3 class="journal-day"></h3>' +
        '<p class="journal-principle handwritten"></p>' +
        '<p class="journal-situation body-text"></p>' +
        '<p class="journal-option"></p>' +
        '<p class="journal-outcome"></p>' +
        '<div class="journal-deltas">' +
        '<span class="delta"></span><span class="delta"></span>' +
        '<span class="journal-tag"></span>' +
        '</div>' +
        '<div class="journal-artifact">' +
        '<p class="journal-artifact-name"></p>' +
        '<p class="journal-artifact-note"></p>' +
        '</div>';

      item.querySelector(".journal-day").textContent = dayLabel + " — " + t(entry.dayTitle);
      item.querySelector(".journal-principle").textContent = t(entry.dayPrinciple);
      item.querySelector(".journal-situation").textContent = t(entry.daySituation);
      item.querySelector(".journal-artifact-name").textContent = tx("artifactLabel") + ": " + t(entry.dayArtifact);
      item.querySelector(".journal-artifact-note").textContent = t(entry.dayArtifactNote);
      item.querySelector(".journal-option").textContent = t(entry.optionText);
      item.querySelector(".journal-outcome").textContent = t(entry.outcomeText);
      item.querySelector(".journal-deltas .journal-tag").textContent = luckTag;

      var deltas = item.querySelectorAll(".journal-deltas .delta");
      setDelta(deltas[0], entry.boevoyDukh);
      setDelta(deltas[1], entry.prodvizhenie);

      els.journalList.appendChild(item);
    });
  }

  // ---------------------------------------------------------------------
  // Карточка результата (canvas)
  // ---------------------------------------------------------------------

  function downloadResultCard() {
    var ending = findEnding(state.endingId);
    var size = { w: 1080, h: 1080 };
    var canvas = els.cardCanvas;
    canvas.width = size.w;
    canvas.height = size.h;
    var ctx = canvas.getContext("2d");

    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      drawCover(ctx, img, size.w, size.h);

      ctx.fillStyle = "rgba(30, 20, 10, 0.55)";
      ctx.fillRect(0, 0, size.w, size.h);

      var pad = size.w * 0.08;
      var y = size.h * 0.62;

      ctx.textAlign = "left";
      ctx.fillStyle = "#f4ead2";

      ctx.font = "700 " + Math.round(size.w * 0.075) + "px Georgia, serif";
      y = wrapText(ctx, ending.emoji + " " + t(ending.title), pad, y, size.w - pad * 2, size.w * 0.09);

      y += size.h * 0.02;
      ctx.font = "400 " + Math.round(size.w * 0.032) + "px Georgia, serif";
      ctx.fillStyle = "#e7dcc2";
      y = wrapText(ctx, "🔥 " + state.boevoyDukh + "   🧭 " + state.prodvizhenie, pad, y, size.w - pad * 2, size.w * 0.045);

      y += size.h * 0.03;
      ctx.font = "italic 400 " + Math.round(size.w * 0.028) + "px Georgia, serif";
      ctx.fillStyle = "#cbbf9f";
      wrapText(ctx, t(game.ui.subtitle), pad, y, size.w - pad * 2, size.w * 0.04);

      triggerDownload(canvas);
    };
    img.onerror = function () {
      window.alert(tx("downloadCardFallback"));
    };
    img.src = ending.image;
  }

  function drawCover(ctx, img, w, h) {
    var scale = Math.max(w / img.width, h / img.height);
    var dw = img.width * scale;
    var dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = text.split(" ");
    var line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i] + " ";
      if (ctx.measureText(test).width > maxWidth && line !== "") {
        ctx.fillText(line, x, y);
        line = words[i] + " ";
        y += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, y);
    return y + lineHeight;
  }

  function triggerDownload(canvas) {
    var link = document.createElement("a");
    link.download = "limax-offensus-" + state.endingId + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // ---------------------------------------------------------------------
  // Навигация между экранами
  // ---------------------------------------------------------------------

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach(function (el) {
      el.hidden = el.dataset.screen !== name;
    });
  }

  // ---------------------------------------------------------------------
  // Числовые счётчики с анимацией
  // ---------------------------------------------------------------------

  function setStatDisplay(el, value, animate) {
    var from = parseInt(el.dataset.value || "0", 10);
    el.dataset.value = value;
    if (!animate || from === value) {
      el.textContent = value;
      return;
    }
    var start = null;
    var duration = 500;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var current = Math.round(from + (value - from) * progress);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------
  // Звук
  // ---------------------------------------------------------------------

  var audioCtx = null;
  var ambientGain = null;
  var ambientSource = null;
  var muted = false;

  function initAudio() {
    muted = localStorage.getItem(STORAGE_MUTED) === "1";
    updateMuteButton();

    els.muteToggle.addEventListener("click", function () {
      muted = !muted;
      localStorage.setItem(STORAGE_MUTED, muted ? "1" : "0");
      updateMuteButton();
      applyMuteState();
    });

    applyMuteState();
  }

  function updateMuteButton() {
    els.muteToggle.textContent = muted ? "🔇" : "🔊";
    var lang = state.lang || "ru";
    els.muteToggle.setAttribute("aria-label", muted ? EXTRA_UI[lang].unmuteLabel : EXTRA_UI[lang].muteLabel);
  }

  function applyMuteState() {
    [els.audioClick, els.audioStatUp, els.audioStatDown, els.audioFail].forEach(function (a) {
      a.muted = muted;
    });
    if (ambientGain) ambientGain.gain.value = muted ? 0 : 0.4;
    else els.audioAmbient.muted = muted;
  }

  function unlockAmbient() {
    if (!audioCtx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
        ambientSource = audioCtx.createMediaElementSource(els.audioAmbient);
        ambientGain = audioCtx.createGain();
        ambientGain.gain.value = muted ? 0 : 0.4;
        ambientSource.connect(ambientGain).connect(audioCtx.destination);
      } catch (e) {
        // Web Audio недоступен — просто проигрываем тег напрямую.
      }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    els.audioAmbient.play().catch(function () {});
  }

  function playClick() {
    playSfx(els.audioClick);
  }

  function playSfx(audioEl) {
    if (muted) return;
    try {
      var clone = audioEl.cloneNode(true);
      clone.volume = 0.8;
      clone.play().catch(function () {});
    } catch (e) {}
  }

  // ---------------------------------------------------------------------
  // Привязка статичных обработчиков (кнопки, которые существуют всегда)
  // ---------------------------------------------------------------------

  function bindStaticEvents() {
    els.meetTeamButton.addEventListener("click", function () {
      playClick();
      showScreen("team");
      renderTeamScreen();
    });

    bindTeamCarouselEvents();

    els.goButton.addEventListener("click", function () {
      playClick();
      resetGameState();
      saveProgress();
      showScreen("day");
      renderDayScreen(true);
    });

    bindNextButton();

    els.playAgainButton.addEventListener("click", function () {
      playClick();
      resetGameState();
      clearProgress();
      renderTitleScreen();
      showScreen("title");
    });

    els.viewJournalButton.addEventListener("click", function () {
      playClick();
      showScreen("journal");
      renderJournalScreen();
    });

    els.journalBackButton.addEventListener("click", function () {
      playClick();
      showScreen("final");
    });

    els.downloadCardButton.addEventListener("click", function () {
      playClick();
      downloadResultCard();
    });
  }

})();
