import { parseSupabaseStorageObjectUrl } from "./imageDelivery";
import { supabase } from "./supabase";

export type ChecklistPdfTask = {
  title: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  beforePhoto?: string;
  afterPhoto?: string;
};

export type ChecklistPdfRecord = {
  title: string;
  assignedCrew?: string;
  sender?: string;
  department?: string;
  checklistType?: string;
  frequency?: string;
  status?: string;
  createdAt?: string;
  completedAt?: string;
  dueDate?: string;
  captainNote?: string;
  tasks: ChecklistPdfTask[];
};

export type YachtLogPdfEvent = {
  title: string;
  detail?: string;
  type?: string;
  date?: string;
};

type ChecklistPdfOptions = {
  fileName: string;
  title: string;
  subtitle: string;
  retentionNote?: string;
};

type YachtLogPdfOptions = {
  fileName: string;
  crewName?: string;
  yachtName?: string;
};

type PdfImage = {
  dataUrl: string;
  width: number;
  height: number;
  format: "PNG" | "JPEG";
};

const logoSource = "/bluedeck-logo-wide-premium-transparent.png";

export async function downloadChecklistPdfDocument(
  records: ChecklistPdfRecord[],
  options: ChecklistPdfOptions
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const logo = await loadPdfImage(logoSource, 1200);
  let y = 0;

  const drawPageHeader = () => {
    doc.setFillColor(7, 22, 49);
    doc.rect(0, 0, pageWidth, 86, "F");

    if (logo) {
      drawContainedImage(doc, logo, margin, 23, 154, 36);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("BLUEDECK", margin, 49);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(151, 224, 239);
    doc.text("YACHT OPERATIONS RECORD", pageWidth - margin, 37, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(220, 235, 241);
    doc.text("Authenticated BlueDeck workspace", pageWidth - margin, 53, { align: "right" });
    y = 112;
  };

  const addPage = () => {
    doc.addPage();
    drawPageHeader();
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 66) return;
    addPage();
  };

  const writeWrapped = (
    text: string,
    x: number,
    maxWidth: number,
    lineHeight = 12
  ) => {
    const lines = doc.splitTextToSize(text || "-", maxWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(lineHeight + 3);
      doc.text(line, x, y);
      y += lineHeight;
    });
  };

  const addProofPhotos = async (task: ChecklistPdfTask) => {
    const sources = [
      { label: "Before", url: task.beforePhoto },
      { label: "After", url: task.afterPhoto },
    ].filter((item): item is { label: string; url: string } => Boolean(item.url));

    if (sources.length === 0) return;

    const images: Array<{ label: string; image: PdfImage }> = [];
    for (const source of sources) {
      const image = await loadPdfImage(source.url, 760);
      if (image) images.push({ label: source.label, image });
    }

    if (images.length === 0) return;

    const cardWidth = 116;
    const cardHeight = 96;
    const gap = 10;
    ensureSpace(cardHeight + 24);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(14, 116, 144);
    doc.text("PROOF PHOTOS", margin + 14, y);
    y += 9;

    images.forEach(({ label, image }, index) => {
      const x = margin + 14 + index * (cardWidth + gap);
      doc.setDrawColor(204, 222, 230);
      doc.setFillColor(247, 251, 252);
      doc.roundedRect(x, y, cardWidth, cardHeight, 7, 7, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(label, x + 7, y + 12);
      drawContainedImage(doc, image, x + 7, y + 18, cardWidth - 14, cardHeight - 25);
    });

    y += cardHeight + 9;
  };

  drawPageHeader();

  doc.setDrawColor(121, 211, 226);
  doc.setFillColor(244, 251, 253);
  doc.roundedRect(margin, y, contentWidth, 70, 12, 12, "FD");
  doc.setTextColor(7, 22, 49);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(options.title, margin + 18, y + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 91, 117);
  doc.text(options.subtitle, margin + 18, y + 48);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(14, 116, 144);
  doc.text(`${records.length} RECORD${records.length === 1 ? "" : "S"}`, pageWidth - margin - 18, y + 39, { align: "right" });
  y += 92;

  for (const [recordIndex, record] of records.entries()) {
    const completedTasks = record.tasks.filter((task) => task.completed).length;
    const progress = record.tasks.length
      ? Math.round((completedTasks / record.tasks.length) * 100)
      : 0;

    ensureSpace(126);
    doc.setDrawColor(204, 222, 230);
    doc.setFillColor(248, 252, 253);
    doc.roundedRect(margin, y, contentWidth, 98, 10, 10, "FD");
    doc.setTextColor(7, 22, 49);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${recordIndex + 1}. ${record.title || "Checklist"}`, margin + 14, y + 21);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    doc.setTextColor(71, 85, 105);
    const leftDetails = [
      record.assignedCrew && `Crew: ${record.assignedCrew}`,
      record.sender && `Sent by: ${record.sender}`,
      `Department: ${record.department || "-"} / ${record.checklistType || "Checklist"}`,
      `Assigned: ${formatPdfDate(record.createdAt)}`,
    ].filter(Boolean) as string[];
    leftDetails.forEach((detail, index) => doc.text(detail, margin + 14, y + 39 + index * 14));

    const rightX = pageWidth - margin - 210;
    doc.text(`Status: ${record.status || "open"}`, rightX, y + 39);
    doc.text(`Progress: ${completedTasks}/${record.tasks.length} (${progress}%)`, rightX, y + 53);
    doc.text(`Completed: ${formatPdfDate(record.completedAt)}`, rightX, y + 67);
    doc.text(`Frequency: ${record.frequency || "-"}`, rightX, y + 81);
    y += 116;

    if (record.captainNote) {
      ensureSpace(50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(147, 93, 15);
      doc.text("CAPTAIN NOTE", margin + 8, y);
      y += 13;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      writeWrapped(record.captainNote, margin + 8, contentWidth - 16, 12);
      y += 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(14, 116, 144);
    doc.text("TASK RECORD", margin, y);
    y += 13;

    for (const [taskIndex, task] of record.tasks.entries()) {
      const taskLines = doc.splitTextToSize(
        `${taskIndex + 1}. ${task.title || "-"}`,
        contentWidth - 112
      ) as string[];
      const taskHeight = Math.max(44, taskLines.length * 12 + 24);
      ensureSpace(taskHeight + (task.beforePhoto || task.afterPhoto ? 126 : 8));

      doc.setDrawColor(task.completed ? 177 : 218, task.completed ? 231 : 229, task.completed ? 205 : 238);
      doc.setFillColor(task.completed ? 239 : 250, task.completed ? 252 : 252, task.completed ? 246 : 253);
      doc.roundedRect(margin, y, contentWidth, taskHeight, 8, 8, "FD");
      doc.setTextColor(7, 22, 49);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(taskLines, margin + 12, y + 18);
      doc.setTextColor(task.completed ? 5 : 100, task.completed ? 130 : 116, task.completed ? 92 : 139);
      doc.setFontSize(7.5);
      doc.text(task.completed ? "COMPLETED" : "OPEN", pageWidth - margin - 12, y + 18, { align: "right" });
      if (task.completedBy || task.completedAt) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.3);
        doc.setTextColor(100, 116, 139);
        doc.text(
          [task.completedBy && `By ${task.completedBy}`, task.completedAt && formatPdfDate(task.completedAt)]
            .filter(Boolean)
            .join(" / "),
          margin + 12,
          y + taskHeight - 8
        );
      }
      y += taskHeight + 8;
      await addProofPhotos(task);
    }

    y += 14;
  }

  addFooters(doc, options.retentionNote || "Generated from authenticated BlueDeck operational records.");
  doc.save(options.fileName);
}

export async function downloadYachtLogPdfDocument(
  events: YachtLogPdfEvent[],
  options: YachtLogPdfOptions
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const logo = await loadPdfImage(logoSource, 1200);
  let y = 0;

  const drawHeader = () => {
    doc.setFillColor(7, 22, 49);
    doc.rect(0, 0, pageWidth, 86, "F");
    if (logo) drawContainedImage(doc, logo, margin, 23, 154, 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(151, 224, 239);
    doc.text("VERIFIED CREW ACTIVITY", pageWidth - margin, 45, { align: "right" });
    y = 112;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 66) return;
    doc.addPage();
    drawHeader();
  };

  drawHeader();
  doc.setDrawColor(121, 211, 226);
  doc.setFillColor(244, 251, 253);
  doc.roundedRect(margin, y, contentWidth, 76, 12, 12, "FD");
  doc.setTextColor(7, 22, 49);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("My Yacht Log", margin + 18, y + 29);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 91, 117);
  doc.text(
    [options.crewName, options.yachtName, `${events.length} recorded event${events.length === 1 ? "" : "s"}`]
      .filter(Boolean)
      .join(" / "),
    margin + 18,
    y + 50
  );
  y += 102;

  events.forEach((event, index) => {
    const detailLines = doc.splitTextToSize(event.detail || "-", contentWidth - 116) as string[];
    const height = Math.max(62, detailLines.length * 12 + 38);
    ensureSpace(height + 10);

    doc.setDrawColor(204, 222, 230);
    doc.setFillColor(249, 252, 253);
    doc.roundedRect(margin + 20, y, contentWidth - 20, height, 9, 9, "FD");
    doc.setFillColor(14, 116, 144);
    doc.circle(margin + 8, y + 18, 4, "F");
    if (index < events.length - 1) {
      doc.setDrawColor(186, 226, 235);
      doc.line(margin + 8, y + 24, margin + 8, y + height + 10);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(7, 22, 49);
    doc.text(event.title || "Activity", margin + 34, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(detailLines, margin + 34, y + 37);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(14, 116, 144);
    doc.text((event.type || "Record").toUpperCase(), pageWidth - margin - 14, y + 19, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(formatPdfDate(event.date), pageWidth - margin - 14, y + 35, { align: "right" });
    y += height + 10;
  });

  addFooters(doc, "Generated from the authenticated BlueDeck My Deck activity log.");
  doc.save(options.fileName);
}

async function loadPdfImage(source: string, max = 960): Promise<PdfImage | null> {
  if (!source) return null;

  try {
    const resolvedSource = await resolvePdfImageSource(source);
    if (!resolvedSource) return null;
    const imageSource = resolvedSource.startsWith("data:image/")
      ? resolvedSource
      : resolvedSource.startsWith("/")
        ? resolvedSource
        : `/api/cv-image?src=${encodeURIComponent(resolvedSource)}&max=${max}&fit=inside`;
    const response = await fetch(imageSource, { cache: "force-cache" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl) return null;
    const dimensions = await getImageDimensions(dataUrl);
    return {
      dataUrl,
      width: dimensions.width,
      height: dimensions.height,
      format: dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG",
    };
  } catch {
    return null;
  }
}

async function resolvePdfImageSource(source: string) {
  const storageObject = parseSupabaseStorageObjectUrl(source);
  if (!storageObject?.isPrivate) return source;

  const { data, error } = await supabase.storage
    .from(storageObject.bucket)
    .createSignedUrl(storageObject.path, 60 * 10);

  return !error && data?.signedUrl ? data.signedUrl : "";
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

function getImageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth || 1,
      height: image.naturalHeight || 1,
    });
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = dataUrl;
  });
}

function drawContainedImage(
  doc: any,
  image: PdfImage,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = Math.max(1, image.width * scale);
  const drawHeight = Math.max(1, image.height * scale);
  try {
    doc.addImage(
      image.dataUrl,
      image.format,
      x + (width - drawWidth) / 2,
      y + (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
      undefined,
      "FAST"
    );
  } catch {
    // An optional image must never block the operational PDF download.
  }
}

function addFooters(doc: any, note: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(23, 84, 96);
    doc.line(margin, pageHeight - 44, pageWidth - margin, pageHeight - 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(note, margin, pageHeight - 27);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(14, 116, 144);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 27, { align: "right" });
  }
}

function formatPdfDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
