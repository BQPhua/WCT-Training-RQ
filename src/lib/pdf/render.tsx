import { renderToBuffer } from "@react-pdf/renderer";
import { TrainingRqDocument } from "./training-rq-document";
import type { PdfData } from "./types";

export type { PdfData };

export async function renderRequestPdf(d: PdfData): Promise<Buffer> {
  return renderToBuffer(<TrainingRqDocument d={d} />);
}
