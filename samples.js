import { extractPurchaseDate, extractTotalAmount } from "./parser.js";

const samples = [
  {
    name: "샘플1 편의점",
    text: `
      사업자번호 123-45-67890
      승인번호 77777777
      결제일시 2026-03-17 08:12
      공급가액 4,545
      부가세 455
      합계금액 5,000원
    `,
    expectedAmount: 5000,
    expectedDate: "2026-03-17"
  },
  {
    name: "샘플2 카페",
    text: `
      매장명 은수카페
      거래일자 26/03/15 14:01
      아메리카노 4,500
      카페라떼 5,200
      카드결제
      총액 9,700
    `,
    expectedAmount: 9700,
    expectedDate: "2026-03-15"
  },
  {
    name: "샘플3 식당",
    text: `
      결제일자 2026년 03월 11일
      소계 24,000
      할인 -2,000
      결제금액 22,000원
      카드번호 1234-****-****-3456
    `,
    expectedAmount: 22000,
    expectedDate: "2026-03-11"
  },
  {
    name: "샘플4 마트",
    text: `
      영수증번호 202603100001
      거래일시 20260310
      면세물품 10,000
      과세물품 12,000
      총결제금액 22,000
    `,
    expectedAmount: 22000,
    expectedDate: "2026-03-10"
  },
  {
    name: "샘플5 숫자노이즈",
    text: `
      전화 02-123-4567
      사업자등록번호 123-45-67890
      결제일 2026.03.09
      승인번호 987654321012
      결제 금액 18,900원
    `,
    expectedAmount: 18900,
    expectedDate: "2026-03-09"
  },
  {
    name: "샘플6 카드앱 상세",
    text: `
      맥도날드
      29,200원
      이용금액 26,545원
      부가세 2,655원
      봉사료 0원
      합계 29,200원
      사용일시 26.03.14 13:10:16
      승인번호 30095184
      사업자번호 1138521083
      가맹점번호 110662596
    `,
    expectedAmount: 29200,
    expectedDate: "2026-03-14"
  }
];

function runSample(sample) {
  const actualAmount = extractTotalAmount(sample.text);
  const actualDate = extractPurchaseDate(sample.text);
  const amountOk = actualAmount === sample.expectedAmount;
  const dateOk = actualDate === sample.expectedDate;

  return {
    name: sample.name,
    amountOk,
    dateOk,
    actualAmount,
    actualDate,
    expectedAmount: sample.expectedAmount,
    expectedDate: sample.expectedDate
  };
}

export function runParserSamples() {
  return samples.map(runSample);
}
