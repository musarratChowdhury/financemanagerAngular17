import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AccumulationChartModule,
  AccumulationLegendService,
  AccumulationTooltipService,
  CategoryService,
  ChartModule,
  ColumnSeriesService,
  IPointRenderEventArgs,
  PieSeriesService,
  TooltipService,
} from '@syncfusion/ej2-angular-charts';
import { BudgetService } from '../../../services/budget.service';
import { MonthSnapshot, MonthlyExpense, SavingsInsight } from '../../../../models/Budget';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import {
  greeting,
  money,
  moneyNegative,
  percent,
  shortDate,
} from '../../../_helpers/money';

interface MonthBar {
  month: string;
  total: number;
  fill: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ChartModule,
    AccumulationChartModule,
    MobileBarComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  providers: [
    CategoryService,
    ColumnSeriesService,
    TooltipService,
    PieSeriesService,
    AccumulationLegendService,
    AccumulationTooltipService,
  ],
})
export class DashboardComponent implements OnInit {
  readonly months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  readonly years: number[] = [];
  readonly selectedMonth = signal(new Date().getMonth() + 1);
  readonly selectedYear = signal(new Date().getFullYear());

  readonly snapshot = signal<MonthSnapshot | null>(null);
  readonly insights = signal<SavingsInsight[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  readonly greeting = greeting();
  readonly money = money;
  readonly moneyNegative = moneyNegative;
  readonly percent = percent;
  readonly shortDate = shortDate;

  /** Rounded column corners, in px. */
  readonly cornerRadius = { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 };

  /** Column markers are off; the tooltip carries the figure. */
  readonly markerSettings = { visible: false };

  readonly primaryXAxis = {
    valueType: 'Category' as const,
    labelStyle: { size: '11px', color: '#5f5f5a' },
    lineStyle: { width: 1.5, color: '#cfcfc8' },
    majorGridLines: { width: 0 },
    majorTickLines: { width: 0 },
    labelIntersectAction: 'None' as const,
  };

  readonly primaryYAxis = {
    labelStyle: { size: '11px', color: '#5f5f5a' },
    lineStyle: { width: 0 },
    majorGridLines: { width: 0 },
    majorTickLines: { width: 0 },
    visible: false,
    minimum: 0,
  };

  readonly chartArea = { border: { width: 0 } };

  readonly tooltip = {
    enable: true,
    fill: '#111111',
    textStyle: { color: '#ffffff', fontFamily: 'Figtree', size: '13px' },
  };

  readonly pieData = computed(() => this.snapshot()?.categories ?? []);
  readonly recent = computed(() => this.snapshot()?.recentExpenses ?? []);

  /** Index-stable slice colours, matching the legend swatches. */
  readonly piePalettes = computed(() => this.pieData().map((c) => c.color));

  /** Total rendered inside the donut hole. */
  readonly pieCenterLabel = computed(() => {
    const total = this.snapshot()?.expenses ?? 0;
    return { text: money(total), textStyle: { size: '18px', fontWeight: '600' } };
  });

  readonly pieLegend = { visible: false };
  readonly pieTooltip = {
    enable: true,
    format: '${point.x}: ${point.y}',
    fill: '#111111',
    textStyle: { color: '#ffffff', fontFamily: 'Figtree', size: '13px' },
  };
  readonly pieDataLabel = { visible: false };

  readonly barData = computed<MonthBar[]>(() => {
    const snap = this.snapshot();
    if (!snap) return [];
    const peak = snap.peakMonth?.totalExpense ?? 0;
    return snap.months.map((m) => ({
      month: m.monthName.slice(0, 3),
      total: m.totalExpense,
      fill: this.barFill(m, peak),
    }));
  });

  constructor(private budgetService: BudgetService) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y--) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.budgetService
      .loadMonth(this.selectedMonth(), this.selectedYear())
      .subscribe({
        next: (snapshot) => {
          this.snapshot.set(snapshot);
          this.insights.set(this.budgetService.buildInsights(snapshot));
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  onMonthChange(value: string): void {
    const month = parseInt(value, 10);
    if (!isNaN(month)) {
      this.selectedMonth.set(month);
      this.load();
    }
  }

  onYearChange(value: string): void {
    const year = parseInt(value, 10);
    if (!isNaN(year)) {
      this.selectedYear.set(year);
      this.load();
    }
  }

  /** Current month black, peak lime, quiet months light grey. */
  private barFill(month: MonthlyExpense, peak: number): string {
    if (month.totalExpense <= 0) return '#e4e4df';
    if (month.month === this.selectedMonth()) return '#111111';
    if (peak > 0 && month.totalExpense === peak) return '#a6cf1d';
    return '#cfcfc8';
  }

  /** Recolour each column from the computed palette. */
  onBarPointRender(args: IPointRenderEventArgs): void {
    const index = args.point.index ?? 0;
    args.fill = this.barData()[index]?.fill ?? '#cfcfc8';
  }

  /** Conic gradient for the donut and the hero split bar. */
  donutGradient(): string {
    const cats = this.pieData();
    if (!cats.length) return '#3a3a36';
    let cursor = 0;
    const stops = cats.map((c) => {
      const start = cursor;
      cursor += c.percent;
      return `${c.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  spentFootnote(): string {
    const snap = this.snapshot();
    if (!snap || snap.expenses <= 0) return 'No expenses recorded yet';
    const peak = snap.peakMonth;
    if (peak && peak.month === snap.month) return `Highest month of ${snap.year}`;
    if (peak && peak.totalExpense > 0) {
      const diff = peak.totalExpense - snap.expenses;
      return `${percent((diff / peak.totalExpense) * 100, 0)} below ${peak.monthName}`;
    }
    return `${snap.categories.length} categories tracked`;
  }

  topCategoryFootnote(): string {
    const top = this.snapshot()?.topCategory;
    if (!top) return 'No spending yet';
    return `${top.categoryName} · ${percent(top.percent)} of spend`;
  }

  balanceFootnote(): string {
    const snap = this.snapshot();
    if (!snap) return '';
    if (snap.income <= 0) return 'No income recorded yet';
    if (snap.balance >= 0) return 'Income covers this month';
    return `${percent((Math.abs(snap.balance) / snap.income) * 100, 0)} over income`;
  }

  balanceLabel(): string {
    const snap = this.snapshot();
    if (!snap) return 'Over budget';
    return snap.balance >= 0 ? 'Left to save' : 'Over budget';
  }

  /** "October · ₨46,657" for the chart footer. */
  peakLabel(): string {
    const peak = this.snapshot()?.peakMonth;
    if (!peak || peak.totalExpense <= 0) return 'no spend yet';
    return `${peak.monthName} · ${money(peak.totalExpense)}`;
  }

  insightSaveLabel(insight: SavingsInsight): string {
    return insight.saving ? `Could free up ${money(insight.saving)}/mo` : '';
  }
}
