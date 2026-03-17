export async function extractReceiptTextFromImage(file, onProgress) {
  if (!file) {
    throw new Error("이미지 파일이 필요합니다.");
  }

  const result = await Tesseract.recognize(file, "kor+eng", {
    logger: (message) => {
      if (message.status === "recognizing text" && typeof onProgress === "function") {
        onProgress(Math.round((message.progress || 0) * 100));
      }
    }
  });

  return result.data.text || "";
}
