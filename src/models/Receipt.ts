/**
 * A receipt plus its line items, as the API's `POST /api/Receipt` expects it.
 *
 * Fields are camelCase because that is the JSON the API accepts and returns;
 * the older PascalCase `Expense` model in this folder is a separate legacy shape.
 */
import { ReceiptImage } from './ReceiptImage';

export interface ReceiptExpensePayload {
  cause: string;
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
  /** ISO instant — `isoUtcDate()` output, not a bare `yyyy-MM-dd`. */
  expenseDate: string;
  expenseCategoryId: number | null;
}

export interface Receipt {
  id?: number;
  merchant: string | null;
  invoiceNo: string | null;
  /** Total before discounts. */
  grossTotal: number;
  discount: number;
  /** Total after discounts — what was actually paid. */
  netPayable: number;
  totalItems: number;
  /** Date and time printed on the receipt, as an ISO instant. */
  receiptDateTime: string;
  expenses: ReceiptExpensePayload[];

  /**
   * Present on responses only: the photo stored for this receipt, and whether
   * one exists at all. The server derives `hasImage`, so a list can show the
   * photo affordance without fetching a URL per row.
   */
  images?: ReceiptImage[];
  hasImage?: boolean;
}
