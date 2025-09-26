import { saveAs } from "file-saver";
import { Document, Packer, Paragraph } from "docx";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export async function exportDocx(text: string) {
  const paragraphs = text.split("\n").map((line) => new Paragraph(line));
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, "letter.docx");
}

export async function exportPdfFromElement(el: HTMLElement) {
  const dataUrl = await toPng(el);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const img = (pdf as any).getImageProperties(dataUrl);
  const ratio = img.width ? pageWidth / img.width : 1;
  const imgHeight = (img.height || 800) * ratio;
  pdf.addImage(dataUrl, "PNG", 0, 0, pageWidth, imgHeight);
  pdf.save("letter.pdf");
}
