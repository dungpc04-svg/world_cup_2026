// scoring.js
// Logic tính điểm phạt dựa trên kết quả kèo châu Á (Asian Handicap).
// Thang điểm CÀNG THẤP CÀNG TỐT (giống golf), theo đúng yêu cầu nghiệp vụ:
//
//   Dự đoán đúng (ăn trọn kèo)      -> 0     điểm
//   Dự đoán đúng nửa (ăn nửa)      -> 0.25  điểm
//   Hòa kèo (push)                 -> 0.5   điểm
//   Dự đoán sai nửa (thua nửa)     -> 0.7   điểm
//   Dự đoán sai (thua trọn)        -> 1     điểm
//   Không dự đoán                  -> 1     điểm
//
// Từ vòng 1/16 (Round of 16) trở đi, toàn bộ mức điểm trên nhân hệ số 2.

const POINTS = {
  WIN: 0,
  HALF_WIN: 0.25,
  PUSH: 0.5,
  HALF_LOSS: 0.7,
  LOSS: 1,
  NO_PICK: 1,
};

const KO_MULTIPLIER = 2;

// Thứ tự vòng đấu dùng để xác định từ vòng nào áp dụng hệ số 2.
// Chỉnh sửa danh sách này trong Firestore (config/rounds) nếu thể thức khác đi.
const ROUND_ORDER = ['group', 'r32', 'r16', 'qf', 'sf', 'final'];
const KO_START_ROUND = 'r16';

function isKnockoutMultiplierRound(round) {
  const idx = ROUND_ORDER.indexOf((round || '').toLowerCase());
  const startIdx = ROUND_ORDER.indexOf(KO_START_ROUND);
  if (idx === -1 || startIdx === -1) return false;
  return idx >= startIdx;
}

// Đánh giá 1 "đơn vị" cược tại 1 mốc handicap (line nguyên hoặc .5).
// Trả về 'win' | 'push' | 'loss'.
// diff = hiệu số bàn thắng đứng về phía đội được chọn (golPickSide - golDoiKia)
function evalUnit(diff, line) {
  const effective = diff + line;
  if (effective > 0) return 'win';
  if (effective === 0) return 'push';
  return 'loss';
}

// Kết hợp 2 kết quả đơn vị (dùng cho kèo lẻ .25 / .75, chia đôi làm 2 mốc kề nhau)
function combine(a, b) {
  if (a === 'win' && b === 'win') return 'WIN';
  if ((a === 'win' && b === 'push') || (a === 'push' && b === 'win')) return 'HALF_WIN';
  if (a === 'push' && b === 'push') return 'PUSH';
  if ((a === 'win' && b === 'loss') || (a === 'loss' && b === 'win')) return 'PUSH';
  if ((a === 'push' && b === 'loss') || (a === 'loss' && b === 'push')) return 'HALF_LOSS';
  return 'LOSS';
}

/**
 * Xác định kết quả kèo châu Á cho 1 lượt dự đoán.
 * @param {'home'|'away'} pickSide - đội người chơi chọn
 * @param {number} line - mốc kèo tại thời điểm chốt (âm nếu đội được chọn là kèo trên)
 * @param {number} homeGoals - bàn thắng đội nhà (kết quả thật)
 * @param {number} awayGoals - bàn thắng đội khách (kết quả thật)
 * @returns {'WIN'|'HALF_WIN'|'PUSH'|'HALF_LOSS'|'LOSS'}
 */
function settleAsianHandicap(pickSide, line, homeGoals, awayGoals) {
  const diff = pickSide === 'home' ? homeGoals - awayGoals : awayGoals - homeGoals;

  const quarterRemainder = Math.abs(line * 4) % 2; // 1 nếu là kèo lẻ .25/.75
  const isQuarterLine = quarterRemainder !== 0 && Math.abs(line % 0.5) !== 0;

  if (!isQuarterLine) {
    const result = evalUnit(diff, line);
    if (result === 'win') return 'WIN';
    if (result === 'push') return 'PUSH'; // chỉ xảy ra với kèo nguyên
    return 'LOSS';
  }

  // Kèo lẻ: chia thành 2 mốc liền kề, mỗi mốc trọng số 0.5
  const lower = line - 0.25;
  const upper = line + 0.25;
  const r1 = evalUnit(diff, lower);
  const r2 = evalUnit(diff, upper);
  return combine(r1, r2);
}

/**
 * Tính điểm phạt cuối cùng cho 1 dự đoán, đã áp hệ số vòng đấu.
 * @param {'WIN'|'HALF_WIN'|'PUSH'|'HALF_LOSS'|'LOSS'|null} outcome - null nếu không dự đoán
 * @param {string} round - mã vòng đấu, vd 'group' | 'r16' | 'qf' | 'sf' | 'final'
 */
function calcPoints(outcome, round) {
  const base = outcome === null ? POINTS.NO_PICK : POINTS[outcome];
  const multiplier = isKnockoutMultiplierRound(round) ? KO_MULTIPLIER : 1;
  return Math.round(base * multiplier * 100) / 100;
}

module.exports = {
  POINTS,
  KO_MULTIPLIER,
  ROUND_ORDER,
  isKnockoutMultiplierRound,
  settleAsianHandicap,
  calcPoints,
};
