const amountStrongKeywordPattern = /(총액|합계|결제금액|받을금액|카드결제|승인금액|합계금액|총결제금액|최종금액)/;
const amountMediumKeywordPattern = /(결제|금액|청구|판매금액|거래금액)/;
const amountNegativeKeywordPattern = /(부가세|면세|공급가액|할인|적립|거스름돈|현금영수증|봉사료|수수료)/;
const amountNoiseKeywordPattern = /(사업자|전화|TEL|카드번호|승인번호|가맹점|대표|주소|영수증번호)/i;
const amountExcludeLinePattern = /(사업자번호|사업자등록번호|승인번호|가맹점번호|카드번호|전화번호|연락처|주소|홈페이지|영수증번호|주문번호|거래번호|주문코드|포인트리|ID|아이디)/i;
const amountDirectLabelPattern = /(총\s*결\s*제\s*금\s*액|총\s*액|합\s*계\s*금\s*액|합\s*계|결\s*제\s*금\s*액|최\s*종\s*금\s*액|받\s*을\s*금\s*액|이\s*용\s*금\s*액)/i;

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeAmountToken(token) {
  return String(token || "")
    .replace(/,/g, "")
    .replace(/[원wW]/g, "")
    .trim();
}

function parseAmountCandidates(line) {
  const matches = line.match(/\d{1,3}(?:,\d{3})+(?:\s?[원wW])?|\d+(?:\s?[원wW])?/g) || [];
  return matches
    .map((rawValue) => {
      const normalized = normalizeAmountToken(rawValue);
      return {
        value: Number(normalized),
        hasCurrencyMark: /[원wW]$/.test(rawValue.trim())
      };
    })
    .filter((candidate) => Number.isFinite(candidate.value) && candidate.value >= 0);
}

function findLabeledAmount(lines) {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (amountExcludeLinePattern.test(line)) {
      continue;
    }

    if (!amountDirectLabelPattern.test(line)) {
      continue;
    }

    const inLineCandidates = parseAmountCandidates(line)
      .map((item) => item.value)
      .filter((value) => value > 0 && !isLikelyNoiseNumber(value));
    if (inLineCandidates.length) {
      return Math.max(...inLineCandidates);
    }

    const nextLine = lines[lineIndex + 1];
    if (!nextLine || amountExcludeLinePattern.test(nextLine)) {
      continue;
    }
    const nextLineCandidates = parseAmountCandidates(nextLine)
      .map((item) => item.value)
      .filter((value) => value > 0 && !isLikelyNoiseNumber(value));
    if (nextLineCandidates.length) {
      return Math.max(...nextLineCandidates);
    }
  }

  return null;
}

function isLikelyNoiseNumber(value) {
  const valueText = String(value);
  if (valueText.length >= 10) {
    return true;
  }
  return false;
}

function buildAmountScore(line, lineIndex, candidate, lineCount) {
  const lowerLine = line.toLowerCase();
  let score = candidate.value;

  if (amountStrongKeywordPattern.test(line)) {
    score += 2_000_000;
  } else if (amountMediumKeywordPattern.test(line)) {
    score += 700_000;
  }

  if (amountNegativeKeywordPattern.test(line)) {
    score -= 900_000;
  }

  if (amountNoiseKeywordPattern.test(line)) {
    score -= 1_200_000;
  }

  if (candidate.hasCurrencyMark) {
    score += 50_000;
  }

  if (isLikelyNoiseNumber(candidate.value)) {
    score -= 1_500_000;
  }

  if (candidate.value < 100) {
    score -= 120_000;
  }

  const nearBottomWeight = Math.max(0, lineIndex - Math.floor(lineCount * 0.35));
  score += nearBottomWeight * 400;

  if (/total|sum/i.test(lowerLine)) {
    score += 300_000;
  }

  return score;
}

export function extractTotalAmount(rawText) {
  const lines = String(rawText || "")
    .split(/\n/g)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const labeledAmount = findLabeledAmount(lines);
  if (labeledAmount !== null) {
    return labeledAmount;
  }

  const lineCount = lines.length;
  let bestCandidate = null;

  lines.forEach((line, lineIndex) => {
    if (amountExcludeLinePattern.test(line)) {
      return;
    }

    const candidates = parseAmountCandidates(line);
    if (!candidates.length) {
      if (amountStrongKeywordPattern.test(line) && lines[lineIndex + 1]) {
        const nextLineCandidates = parseAmountCandidates(lines[lineIndex + 1]);
        if (nextLineCandidates.length) {
          const nextMax = Math.max(...nextLineCandidates.map((item) => item.value));
          const boostedScore = nextMax + 1_700_000 - lineIndex;
          if (!bestCandidate || boostedScore > bestCandidate.score) {
            bestCandidate = { value: nextMax, score: boostedScore };
          }
        }
      }
      return;
    }

    const sorted = [...candidates].sort((a, b) => b.value - a.value);
    const currentCandidate = sorted[0];
    const score = buildAmountScore(line, lineIndex, currentCandidate, lineCount);

    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = { value: currentCandidate.value, score };
    }
  });

  return bestCandidate ? bestCandidate.value : null;
}

function formatDateValue(year, month, day) {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidDateValue(year, month, day) {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const parsedDay = Number(day);

  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth) || !Number.isFinite(parsedDay)) {
    return false;
  }

  if (parsedYear < 2000 || parsedYear > 2099) {
    return false;
  }

  if (parsedMonth < 1 || parsedMonth > 12) {
    return false;
  }

  if (parsedDay < 1 || parsedDay > 31) {
    return false;
  }

  const date = new Date(parsedYear, parsedMonth - 1, parsedDay);
  return (
    date.getFullYear() === parsedYear
    && date.getMonth() === parsedMonth - 1
    && date.getDate() === parsedDay
  );
}

export function extractPurchaseDate(rawText) {
  const text = String(rawText || "");
  const normalized = text.replace(/\s+/g, " ");
  const patterns = [
    /(\d{2})[./-](\d{1,2})[./-](\d{1,2})\s+\d{1,2}:\d{2}(?::\d{2})?/g,
    /(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/g,
    /(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
    /(\d{2})[./-](\d{1,2})[./-](\d{1,2})/g,
    /(20\d{2})(\d{2})(\d{2})/g
  ];

  const candidates = [];

  patterns.forEach((pattern, patternIndex) => {
    const matches = normalized.matchAll(pattern);
    for (const match of matches) {
      let year = match[1];
      let month = match[2];
      let day = match[3];

      if (patternIndex === 0 || patternIndex === 3) {
        const currentCentury = new Date().getFullYear().toString().slice(0, 2);
        year = `${currentCentury}${year}`;
      }

      if (!isValidDateValue(year, month, day)) {
        continue;
      }

      candidates.push({
        value: formatDateValue(year, month, day),
        position: match.index || 0
      });
    }
  });

  if (!candidates.length) {
    return null;
  }

  const sortedCandidates = candidates.sort((a, b) => a.position - b.position);
  return sortedCandidates[0].value;
}
