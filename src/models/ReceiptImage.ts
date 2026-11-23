/**
 * The softcopy stored for a receipt. Mirrors the API's `ReceiptImageDto`: the
 * object key never leaves the server — photos are only reachable through a
 * short-lived signed URL.
 */
export interface ReceiptImage {
  id: number;
  /** image/jpeg, image/png or image/webp. */
  contentType: string;
  sizeBytes: number;
  /** ISO instant. */
  uploadedAt: string;
}
