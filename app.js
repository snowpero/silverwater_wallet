import { saveReceipt, getAllReceipts } from "./db.js";
import { extractReceiptTextFromImage } from "./ocr.js";
import { extractTotalAmount, extractPurchaseDate } from "./parser.js";
import {
  formatKrw,
  filterByPeriod,
  buildDailyGroups,
  computeOverview,
  buildMonthlySeries
} from "./stats.js";
import { runParserSamples } from "./samples.js";

const state = {
  receipts: [],
  selectedPeriod: "thisMonth",
  chart: null,
  selectedImageDataUrl: ""
};

const elements = {
  periodFilter: document.getElementById("periodFilter"),
  thisMonthTotal: document.getElementById("thisMonthTotal"),
  lastMonthTotal: document.getElementById("lastMonthTotal"),
  monthDelta: document.getElementById("monthDelta"),
  monthDeltaRate: document.getElementById("monthDeltaRate"),
  dailyAverage: document.getElementById("dailyAverage"),
  allTimeTotal: document.getElementById("allTimeTotal"),
  receiptForm: document.getElementById("receiptForm"),
  receiptImage: document.getElementById("receiptImage"),
  previewImage: document.getElementById("previewImage"),
  ocrButton: document.getElementById("ocrButton"),
  ocrStatus: document.getElementById("ocrStatus"),
  purchaseDate: document.getElementById("purchaseDate"),
  totalAmount: document.getElementById("totalAmount"),
  storeName: document.getElementById("storeName"),
  rawText: document.getElementById("rawText"),
  dailyList: document.getElementById("dailyList"),
  monthlyChart: document.getElementById("monthlyChart"),
  parserTestResult: document.getElementById("parserTestResult")
};

function createId() {
  return `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("이미지 읽기에 실패했습니다."));
    reader.readAsDataURL(file);
  });
}

function renderDailyList(groups) {
  if (!groups.length) {
    elements.dailyList.innerHTML = '<p class="status-text">저장된 내역이 없습니다.</p>';
    return;
  }

  elements.dailyList.innerHTML = groups
    .map((group) => {
      const detail = group.items
        .map((item) => `${item.storeName || "상호 미입력"}: ${formatKrw(item.totalAmount)}`)
        .join("<br />");

      return `
        <article class="daily-item">
          <div class="daily-head">
            <span>${group.date}</span>
            <span>${formatKrw(group.total)}</span>
          </div>
          <div class="daily-detail">
            <span>건수: ${group.items.length}건</span>
            <span>${detail}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderParserTests() {
  const results = runParserSamples();
  elements.parserTestResult.innerHTML = results
    .map((result) => {
      const pass = result.amountOk && result.dateOk;
      const statusClass = pass ? "test-pass" : "test-fail";
      const statusText = pass ? "통과" : "실패";
      return `
        <article class="daily-item">
          <div class="daily-head">
            <span>${result.name}</span>
            <span class="${statusClass}">${statusText}</span>
          </div>
          <div class="daily-detail">
            <span>금액: 예상 ${formatKrw(result.expectedAmount)} / 실제 ${formatKrw(result.actualAmount || 0)}</span>
            <span>날짜: 예상 ${result.expectedDate} / 실제 ${result.actualDate || "미추출"}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderChart(labels, values) {
  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(elements.monthlyChart, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "월별 총지출",
          data: values,
          borderWidth: 1,
          borderColor: "#a85d39",
          backgroundColor: "rgba(168, 93, 57, 0.28)"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => `${Number(value).toLocaleString("ko-KR")}원`
          }
        }
      }
    }
  });
}

function render() {
  const filteredReceipts = filterByPeriod(state.receipts, state.selectedPeriod);
  const overview = computeOverview(state.receipts, filteredReceipts);
  const groups = buildDailyGroups(filteredReceipts);
  const monthlySeries = buildMonthlySeries(state.receipts);

  elements.thisMonthTotal.textContent = formatKrw(overview.thisMonthTotal);
  elements.lastMonthTotal.textContent = formatKrw(overview.lastMonthTotal);
  elements.monthDelta.textContent = formatKrw(overview.deltaAmount);
  elements.monthDeltaRate.textContent =
    overview.deltaRate === null ? "비교불가" : `${overview.deltaRate.toFixed(1)}%`;
  elements.dailyAverage.textContent = formatKrw(overview.dailyAverage);
  elements.allTimeTotal.textContent = formatKrw(overview.allTimeTotal);

  renderDailyList(groups);
  renderChart(monthlySeries.labels, monthlySeries.values);
  renderParserTests();
}

async function loadReceipts() {
  state.receipts = await getAllReceipts();
  render();
}

async function handleImagePreviewChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  state.selectedImageDataUrl = dataUrl;
  elements.previewImage.src = dataUrl;
  elements.previewImage.classList.remove("hidden");
}

async function handleOcrClick() {
  const file = elements.receiptImage.files?.[0];
  if (!file) {
    alert("이미지를 먼저 선택해주세요.");
    return;
  }

  elements.ocrStatus.textContent = "OCR 처리 준비 중...";

  try {
    const rawText = await extractReceiptTextFromImage(file, (progressValue) => {
      elements.ocrStatus.textContent = `OCR 진행 중... ${progressValue}%`;
    });

    elements.rawText.value = rawText;

    const amount = extractTotalAmount(rawText);
    if (amount !== null) {
      elements.totalAmount.value = String(amount);
    }

    const purchaseDate = extractPurchaseDate(rawText);
    if (purchaseDate) {
      elements.purchaseDate.value = purchaseDate;
    }

    elements.ocrStatus.textContent = "OCR 완료. 값 확인 후 저장해주세요.";
  } catch (error) {
    elements.ocrStatus.textContent = `OCR 실패: ${error.message}`;
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const purchaseDate = elements.purchaseDate.value;
  const totalAmount = Number(elements.totalAmount.value || 0);
  const rawText = elements.rawText.value;

  if (!purchaseDate || !Number.isFinite(totalAmount) || totalAmount < 0) {
    alert("결제일과 총 금액을 정확히 입력해주세요.");
    return;
  }

  const receipt = {
    id: createId(),
    purchaseDate,
    totalAmount,
    storeName: elements.storeName.value.trim(),
    rawText,
    imageDataUrl: state.selectedImageDataUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await saveReceipt(receipt);
  state.receipts.push(receipt);

  elements.receiptForm.reset();
  elements.previewImage.src = "";
  elements.previewImage.classList.add("hidden");
  elements.ocrStatus.textContent = "저장 완료. 다음 영수증을 등록할 수 있어요.";
  state.selectedImageDataUrl = "";

  render();
}

function bindEvents() {
  elements.periodFilter.addEventListener("change", (event) => {
    state.selectedPeriod = event.target.value;
    render();
  });
  elements.receiptImage.addEventListener("change", handleImagePreviewChange);
  elements.ocrButton.addEventListener("click", handleOcrClick);
  elements.receiptForm.addEventListener("submit", handleSubmit);
}

async function initialize() {
  bindEvents();
  await loadReceipts();
}

initialize();
