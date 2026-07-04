/**
 * Monte Carlo симулятор баланса концовок (раздел 2 и 11.4 проектного документа).
 * Прогоняет N случайных прохождений по вероятностям исходов из data/game.json
 * и печатает распределение по всем 6 концовкам. Вне самой игры — только для
 * проверки баланса, в браузерный код не подключается.
 *
 * Запуск: node scripts/simulate.js [число_прогонов]
 */
const fs = require("fs");
const path = require("path");
const { resolveEnding } = require("../js/endings.js");

const game = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "game.json"), "utf8")
);

const RUNS = parseInt(process.argv[2], 10) || 20000;

function pickOutcome(option) {
  const total = option.outcomes.reduce((s, o) => s + o.chance, 0);
  let roll = Math.random() * total;
  for (const outcome of option.outcomes) {
    if (roll < outcome.chance) return outcome;
    roll -= outcome.chance;
  }
  return option.outcomes[option.outcomes.length - 1];
}

function playOnce() {
  let boevoyDukh = 0;
  let prodvizhenie = 0;

  for (const day of game.days) {
    const option = day.options[Math.floor(Math.random() * day.options.length)];
    const outcome = pickOutcome(option);
    boevoyDukh += outcome.boevoyDukh;
    prodvizhenie += outcome.prodvizhenie;
    if (outcome.fail) {
      return { ending: resolveEnding(boevoyDukh, prodvizhenie, true), boevoyDukh, prodvizhenie, day: day.day };
    }
  }

  return { ending: resolveEnding(boevoyDukh, prodvizhenie, false), boevoyDukh, prodvizhenie, day: 10 };
}

const counts = {};
for (const ending of game.endings) counts[ending.id] = 0;

let sumBD = 0;
let sumP = 0;
let minBD = Infinity, maxBD = -Infinity, minP = Infinity, maxP = -Infinity;

for (let i = 0; i < RUNS; i++) {
  const result = playOnce();
  counts[result.ending] += 1;
  sumBD += result.boevoyDukh;
  sumP += result.prodvizhenie;
  if (result.boevoyDukh < minBD) minBD = result.boevoyDukh;
  if (result.boevoyDukh > maxBD) maxBD = result.boevoyDukh;
  if (result.prodvizhenie < minP) minP = result.prodvizhenie;
  if (result.prodvizhenie > maxP) maxP = result.prodvizhenie;
}

console.log(`Monte Carlo: ${RUNS} случайных прохождений (вариант каждого дня выбирается равновероятно, исход — по весам из game.json)\n`);
console.log("Распределение концовок:");
for (const ending of game.endings) {
  const n = counts[ending.id];
  const pct = ((n / RUNS) * 100).toFixed(2);
  console.log(`  ${ending.emoji}  ${ending.title.ru.padEnd(38)} ${n.toString().padStart(6)}  (${pct}%)`);
}

console.log("\nДиапазон показателей по всем прогонам:");
console.log(`  Боевой дух:      среднее ${(sumBD / RUNS).toFixed(1)}, мин ${minBD}, макс ${maxBD}`);
console.log(`  Продвижение:     среднее ${(sumP / RUNS).toFixed(1)}, мин ${minP}, макс ${maxP}`);
