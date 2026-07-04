/**
 * Monte Carlo симулятор баланса концовок (раздел 2 и 11.4 проектного документа).
 * Прогоняет N прохождений по вероятностям исходов из data/game.json и печатает
 * распределение по всем 6 концовкам. Вне самой игры — только для проверки
 * баланса, в браузерный код не подключается.
 *
 * Три политики выбора варианта каждого дня:
 *   random — вариант выбирается равновероятно (базовая линия);
 *   warm   — всегда выбирается вариант, отмеченный ниже как «тёплый»
 *            (приоритет отношениям/чувствам человека, даже в ущерб чёткости);
 *   hard   — всегда выбирается вариант, отмеченный как «жёсткий/конкретный»
 *            (приоритет фактам/стандарту, даже в ущерб отношениям).
 *
 * В data/game.json такой оси нет — это не число, а прочтение смысла текста
 * каждого варианта, поэтому разметка WARM_MAP/HARD_MAP ниже сделана вручную
 * и печатается в выводе для проверки, а не спрятана внутри кода.
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

// day -> optionId. Один полюс на день: "тёплый" (заботится о человеке) vs
// "жёсткий/конкретный" (заботится о факте/стандарте), не "правильный/неправильный" —
// у части дней тёплый вариант совпадает с психологически верным, у части нет.
const WARM_MAP = { 1: "B", 2: "A", 3: "A", 4: "B", 5: "B", 6: "A", 7: "A", 8: "B", 9: "B", 10: "B" };
const HARD_MAP = { 1: "G", 2: "B", 3: "V", 4: "G", 5: "G", 6: "B", 7: "B", 8: "A", 9: "A", 10: "G" };

function pickOutcome(option) {
  const total = option.outcomes.reduce((s, o) => s + o.chance, 0);
  let roll = Math.random() * total;
  for (const outcome of option.outcomes) {
    if (roll < outcome.chance) return outcome;
    roll -= outcome.chance;
  }
  return option.outcomes[option.outcomes.length - 1];
}

function chooseOption(day, policy) {
  if (policy === "random") {
    return day.options[Math.floor(Math.random() * day.options.length)];
  }
  const map = policy === "warm" ? WARM_MAP : HARD_MAP;
  const optionId = map[day.day];
  const option = day.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`Нет варианта ${optionId} в дне ${day.day} (policy ${policy})`);
  return option;
}

function playOnce(policy) {
  let boevoyDukh = 0;
  let prodvizhenie = 0;

  for (const day of game.days) {
    const option = chooseOption(day, policy);
    const outcome = pickOutcome(option);
    boevoyDukh += outcome.boevoyDukh;
    prodvizhenie += outcome.prodvizhenie;
    if (outcome.fail) {
      return { ending: resolveEnding(boevoyDukh, prodvizhenie, true), boevoyDukh, prodvizhenie };
    }
  }

  return { ending: resolveEnding(boevoyDukh, prodvizhenie, false), boevoyDukh, prodvizhenie };
}

function runPolicy(policy, label) {
  const counts = {};
  for (const ending of game.endings) counts[ending.id] = 0;

  let sumBD = 0, sumP = 0;
  let minBD = Infinity, maxBD = -Infinity, minP = Infinity, maxP = -Infinity;

  for (let i = 0; i < RUNS; i++) {
    const result = playOnce(policy);
    counts[result.ending] += 1;
    sumBD += result.boevoyDukh;
    sumP += result.prodvizhenie;
    if (result.boevoyDukh < minBD) minBD = result.boevoyDukh;
    if (result.boevoyDukh > maxBD) maxBD = result.boevoyDukh;
    if (result.prodvizhenie < minP) minP = result.prodvizhenie;
    if (result.prodvizhenie > maxP) maxP = result.prodvizhenie;
  }

  console.log(`\n=== ${label} (${RUNS} прохождений) ===`);
  for (const ending of game.endings) {
    const n = counts[ending.id];
    const pct = ((n / RUNS) * 100).toFixed(2);
    console.log(`  ${ending.emoji}  ${ending.title.ru.padEnd(38)} ${n.toString().padStart(6)}  (${pct}%)`);
  }
  console.log(`  Боевой дух:  среднее ${(sumBD / RUNS).toFixed(1)}, мин ${minBD}, макс ${maxBD}`);
  console.log(`  Продвижение: среднее ${(sumP / RUNS).toFixed(1)}, мин ${minP}, макс ${maxP}`);
}

console.log("Разметка «тёплый»/«жёсткий» вариант по дням (ручная, не из game.json):");
for (const day of game.days) {
  console.log(`  День ${String(day.day).padStart(2)}: тёплый = ${WARM_MAP[day.day]}, жёсткий = ${HARD_MAP[day.day]}`);
}

runPolicy("random", "Политика: случайный выбор (равновероятно)");
runPolicy("warm", "Политика: всегда «тёплый» вариант");
runPolicy("hard", "Политика: всегда «жёсткий/конкретный» вариант");
