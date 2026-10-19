import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from '@syncfusion/ej2-angular-popups';
import { ExpenseCategoryService } from '../../../services/expense-category.service';
import { BudgetService } from '../../../services/budget.service';
import { CATEGORY_COLORS } from '../../../../models/Budget';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import { money, percent } from '../../../_helpers/money';

interface CategoryRow {
  id: number;
  name: string;
  color: string;
  /** Spend in the selected month, joined from the month snapshot. */
  spent: number;
  share: number;
}

/**
 * Categories — organise the buckets, and see what each one is costing.
 *
 * Mobile-first: rows stack with the amount on the right. From 768px the same
 * data reads as a table.
 */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, MobileBarComponent],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css',
})
export class CategoriesComponent implements OnInit {
  readonly money = money;
  readonly percent = percent;

  readonly rows = signal<CategoryRow[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly monthLabel = signal('');

  /* dialog state */
  readonly dialogVisible = signal(false);
  readonly editingId = signal<number | null>(null);
  draftName = '';
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter((r) => r.name.toLowerCase().includes(term));
  });

  readonly totalSpent = computed(() =>
    this.rows().reduce((sum, r) => sum + r.spent, 0)
  );

  readonly isEditing = computed(() => this.editingId() !== null);

  constructor(
    private expenseCategoryService: ExpenseCategoryService,
    private budgetService: BudgetService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);

    const now = new Date();
    this.monthLabel.set(
      now.toLocaleString('en-US', { month: 'long' }).toUpperCase()
    );

    this.expenseCategoryService.getAll().subscribe({
      next: (data: any[]) => {
        const base = (data ?? []).map((c, i) => ({
          id: c.id,
          name: c.name ?? 'Untitled',
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          spent: 0,
          share: 0,
        }));

        // Enrich with this month's spend where the categories line up.
        this.budgetService
          .loadMonth(now.getMonth() + 1, now.getFullYear())
          .subscribe({
            next: (snapshot) => {
              const spendById = new Map(
                snapshot.categories.map((c) => [c.categoryId, c.totalAmount])
              );
              const total = snapshot.expenses || 1;
              this.rows.set(
                base.map((r) => {
                  const spent = spendById.get(r.id) ?? 0;
                  return { ...r, spent, share: (spent / total) * 100 };
                })
              );
              this.loading.set(false);
            },
            // Categories still list fine without spend figures.
            error: () => {
              this.rows.set(base);
              this.loading.set(false);
            },
          });
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  openAdd(): void {
    this.editingId.set(null);
    this.draftName = '';
    this.errorMessage.set('');
    this.dialogVisible.set(true);
  }

  openEdit(row: CategoryRow): void {
    this.editingId.set(row.id);
    this.draftName = row.name;
    this.errorMessage.set('');
    this.dialogVisible.set(true);
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
    this.saving.set(false);
  }

  save(): void {
    const name = this.draftName.trim();
    if (!name || this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set('');

    const id = this.editingId();
    const payload = { name };

    const request$ =
      id === null
        ? this.expenseCategoryService.create(payload as any)
        : this.expenseCategoryService.update(id, payload as any);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Could not save the category. Please try again.');
      },
    });
  }

  remove(row: CategoryRow): void {
    // Deleting a category that has spend would orphan those expenses, so the
    // guard is deliberate rather than a confirmation dialog nobody reads.
    if (row.spent > 0) {
      this.errorMessage.set(
        `${row.name} has ${money(row.spent)} recorded this month — move those expenses before deleting it.`
      );
      this.editingId.set(null);
      this.draftName = row.name;
      this.dialogVisible.set(true);
      return;
    }

    this.expenseCategoryService.delete(row.id).subscribe({
      next: () => this.load(),
      error: () =>
        this.errorMessage.set('Could not delete the category. Please try again.'),
    });
  }
}
