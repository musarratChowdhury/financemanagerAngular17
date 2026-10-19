import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EnvelopeBudgetService } from '../../../services/envelope-budget.service';
import { EnvelopeBudget } from '../../../../models/EnvelopeBudget';
import { MONTH_NAMES } from '../../../../models/Budget';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import { money } from '../../../_helpers/money';

@Component({
  selector: 'app-envelopes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MobileBarComponent],
  templateUrl: './envelopes.component.html',
  styleUrl: './envelopes.component.css',
})
export class EnvelopesComponent implements OnInit {
  readonly money = money;
  readonly monthNames = MONTH_NAMES;
  readonly months = MONTH_NAMES.map((_, index) => index + 1);
  readonly years = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - 5 + index);
  readonly selectedMonth = signal(new Date().getMonth() + 1);
  readonly selectedYear = signal(new Date().getFullYear());
  readonly budgets = signal<EnvelopeBudget[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly saving = signal<number | null>(null);
  readonly saveError = signal('');
  readonly configured = computed(() => this.budgets().filter((budget) => budget.limitAmount > 0));
  readonly topUtilisation = computed(() => this.configured().slice(0, 3));

  constructor(private envelopeService: EnvelopeBudgetService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.saveError.set('');
    this.envelopeService.load(this.selectedMonth(), this.selectedYear()).subscribe({
      next: (budgets) => {
        this.budgets.set(budgets);
        this.loading.set(false);
      },
      error: () => {
        this.budgets.set([]);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  onMonth(value: string): void {
    this.selectedMonth.set(Number(value));
    this.load();
  }

  onYear(value: string): void {
    this.selectedYear.set(Number(value));
    this.load();
  }

  save(budget: EnvelopeBudget): void {
    this.saving.set(budget.categoryId);
    this.saveError.set('');
    this.envelopeService.save(budget).subscribe({
      next: () => {
        this.saving.set(null);
        this.load();
      },
      error: () => {
        this.saving.set(null);
        this.saveError.set('Could not save this limit. Please try again.');
      },
    });
  }

  status(budget: EnvelopeBudget): string {
    return this.envelopeService.status(budget);
  }

  percent(budget: EnvelopeBudget): number {
    return Math.min(100, Math.max(0, this.envelopeService.utilisation(budget) * 100));
  }
}
