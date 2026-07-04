/**
 * Monte Carlo симулятор баланса концовок (раздел 2 и 11.4 проектного документа).
 * Прогоняет N прохождений по вероятностям исходов из data/game.json и печатает
 * распределение по всем 6 концовкам. Вне самой игры — только для проверки
 * баланса, в браузерный код не подключается.
 *
 * Три политики выбора варианта каждого дня:
 *   random — вариант выбирается равновероятно (базовая линия);
 *   warm   — всегда выбирается вариант, отмеченный ниже как «тёплый»: избегает
 *            прямого/конкретного разговора ради комфорта момента (расплывчатая
 *            похвала, молчаливое делегирование, «само рассосётся», тихо
 *            исправить самому) — даже там, где это явно стоит продвижения;
 *   hard   — всегда выбирается вариант, отмеченный как «жёсткий/конкретный»
 *            (приоритет фактам/стандарту, даже в ущерб отношениям и несмотря
 *            на состояние человека).
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

// day -> optionId. HARD_MAP — "дожимать факты/стандарт, игнорируя состояние
// человека". WARM_MAP здесь — НЕ "лучший по обеим осям вариант" (первая версия
// карты так и получилась: для 7 из 10 дней тёплый и технически верный вариант
// совпадали, и политика warm мерила скорее "играть по учебнику", чем реальный
// компромисс). Здесь WARM_MAP переразмечена под конкретный критерий: избегать
// прямого/конкретного разговора ради комфорта момента — расплывчатая похвала,
// молчаливое делегирование, "само рассосётся", тихо сделать за человека — даже
// там, где это явно стоит продвижения. День 9 — исключение: там психологически
// верный ответ (B) и есть "не давать фидбек сейчас", это сама механика дня, а
// не совпадение, так что для WARM взят более крайний по избеганию вариант (G,
// молча всё исправить и не упоминать ошибку вовсе), чтобы не задваивать B.
const WARM_MAP = { 1: "V", 2: "A", 3: "G", 4: "V", 5: "V", 6: "V", 7: "V", 8: "G", 9: "G", 10: "B" };
const HARD_MAP = { 1: "G", 2: "B", 3: "V", 4: "G", 5: "G", 6: "B", 7: "B", 8: "A", 9: "A", 10: "G" };

// Опортунистическая политика — не ручная разметка, а гипотеза "специально
// собирать боевой дух и осознанно проваливать продвижение", посчитанная прямо
// из вероятностей: для каждого варианта считаем EV(боевой дух) и EV(продвижение)
// по данным, и берём вариант с максимальным (EV(БД) − EV(П)) — то есть вариант,
// который выгоднее всего именно как "тепло за счёт прогресса", а не просто
// "лучший вариант дня". Карта строится программно и печатается для проверки,
// а не подгоняется под желаемый результат.
function expectedValue(option) {
  const total = option.outcomes.reduce((s, o) => s + o.chance, 0);
  let bd = 0, p = 0;
  for (const outcome of option.outcomes) {
    bd += (outcome.chance / total) * outcome.boevoyDukh;
    p += (outcome.chance / total) * outcome.prodvizhenie;
  }
  return { bd, p };
}

function buildOpportunisticMap() {
  const map = {};
  const evByDay = {};
  for (const day of game.days) {
    let best = null;
    const evs = {};
    for (const option of day.options) {
      const ev = expectedValue(option);
      evs[option.id] = ev;
      const score = ev.bd - ev.p;
      if (!best || score > best.score) best = { id: option.id, score };
    }
    map[day.day] = best.id;
    evByDay[day.day] = evs;
  }
  return { map, evByDay };
}

const { map: OPPORTUNISTIC_MAP, evByDay: OPPORTUNISTIC_EV } = buildOpportunisticMap();

function pickOutcome(option) {
  const total = option.outcomes.reduce((s, o) => s + o.chance, 0);
  let roll = Math.random() * total;
  for (const outcome of option.outcomes) {
    if (roll < outcome.chance) return outcome;
    roll -= outcome.chance;
  }
  return option.outcomes[option.outcomes.length - 1];
}

const OPTION_MAPS = { warm: WARM_MAP, hard: HARD_MAP, opportunistic: OPPORTUNISTIC_MAP };

function chooseOption(day, policy) {
  if (policy === "random") {
    return day.options[Math.floor(Math.random() * day.options.length)];
  }
  const optionId = OPTION_MAPS[policy][day.day];
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

console.log("\nОпортунистическая карта (посчитана из EV(БД)−EV(П) по данным, не размечена вручную):");
for (const day of game.days) {
  const picked = OPPORTUNISTIC_MAP[day.day];
  const ev = OPPORTUNISTIC_EV[day.day][picked];
  console.log(`  День ${String(day.day).padStart(2)}: ${picked}  (EV БД=${ev.bd.toFixed(1)}, EV П=${ev.p.toFixed(1)})`);
}

runPolicy("random", "Политика: случайный выбор (равновероятно)");
runPolicy("warm", "Политика: всегда «тёплый» вариант (избегающий)");
runPolicy("hard", "Политика: всегда «жёсткий/конкретный» вариант");
runPolicy("opportunistic", "Политика: опортунистическая (максимум EV(БД) − EV(П) по дню)");
