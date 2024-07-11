import { Component, OnInit, ViewChild } from '@angular/core';
import {
  AccumulationChartComponent,
  AccumulationChartModule,
  AreaSeriesService,
  BarSeriesService,
  CategoryService,
  ChartModule,
  ColumnSeriesService,
  DateTimeService,
  IAccTooltipRenderEventArgs,
  LineSeriesService,
  RangeAreaSeriesService,
  ScatterSeriesService,
  ScrollBarService,
  SelectionService,
  SplineSeriesService,
  StackingBarSeriesService,
  StackingColumnSeriesService,
  StepAreaSeriesService,
  StripLineService,
  ZoomService,
} from '@syncfusion/ej2-angular-charts';
import {
  PieSeriesService,
  AccumulationLegendService,
  AccumulationTooltipService,
  AccumulationAnnotationService,
  AccumulationDataLabelService,
} from '@syncfusion/ej2-angular-charts';
import { DashboardService } from '../../../services/dashboard.service';
import { MonthlyExpense } from '../../../../models/BarChartData';
interface PieData {
  x: string;
  y: number;
  text: string;
}
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ChartModule, AccumulationChartModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  providers: [
    LineSeriesService,
    DateTimeService,
    ColumnSeriesService,
    AccumulationDataLabelService,
    ZoomService,
    StackingColumnSeriesService,
    CategoryService,
    StepAreaSeriesService,
    SplineSeriesService,
    AccumulationAnnotationService,
    AccumulationLegendService,
    AccumulationTooltipService,
    StripLineService,
    PieSeriesService,
    AccumulationTooltipService,
    ScrollBarService,
    AccumulationDataLabelService,
    SelectionService,
    ScatterSeriesService,
    AreaSeriesService,
    RangeAreaSeriesService,
    BarSeriesService,
    StackingBarSeriesService,
  ],
})
export class DashboardComponent implements OnInit {
  @ViewChild('piechart') piechart: AccumulationChartComponent | undefined;
  public piedata?: PieData[];
  public legendSettings?: Object;
  public tooltip?: Object;
  public title?: string;
  public datalabel?: Object;
  public barChartData?: Object[];
  public barChartTitle?: string;
  primaryXAxis: any;
  primaryYAxis: any;
  TotalCostOccuredThisMonth: number = 0;

  constructor(private dashboardService: DashboardService) {}

  public tooltipRender(args: IAccTooltipRenderEventArgs): void {
    let value = (args.point.y / args.series.sumOfPoints) * 100;
    args['text'] = args.point.x + ' : ' + Math.ceil(value) + '' + '%';
  }
  ngOnInit(): void {
    var x = this.dashboardService.get().subscribe({
      next: (data: any[]) => {
        console.log(data);
        this.updatePieChartData(data);
      },
      error: (err) => console.log(err),
    });

    var y = this.dashboardService.getBarChartData().subscribe({
      next: (data: MonthlyExpense[]) => {
        console.log('barchartdata', data);
        this.barChartTitle = `${
          isNaN(data[0].year) ? data[0].year : new Date().getFullYear()
        }`;
        this.barChartData = data.map((m) => ({
          x: m.monthName,
          y: m.totalExpense,
          text: m.monthName,
        }));
        console.log(this.barChartData);
      },
      error: (err) => console.log(err),
    });

    this.primaryXAxis = {
      valueType: 'Category',
      title: 'Months',
    };
    this.datalabel = { visible: true };
    this.legendSettings = {
      visible: true,
    };
    this.tooltip = {
      enable: true,
    };
    this.title = `Total Cost Occured This month : ${this.TotalCostOccuredThisMonth}`;
  }

  onMonthChange(event: Event): void {
    const selectedMonth = (event.target as HTMLSelectElement).value;
    console.log('Selected Month:', selectedMonth);

    const monthNo = parseInt(selectedMonth, 10);

    if (!isNaN(monthNo)) {
      this.dashboardService.getExpensesOfAMonth(monthNo).subscribe({
        next: (data) => {
          console.log('Monthly data:', data);
          this.updatePieChartData(data);
        },
        error: (err) => console.error('Error fetching data:', err),
      });
    } else {
      console.error('Invalid month number');
    }
  }

  updatePieChartData(data: any[]): void {
    this.tooltip = new Object();
    this.piedata = data.map((category) => ({
      x: category.categoryName,
      y: category.totalAmount,
      text: `${category.categoryName}: ${category.totalAmount}`,
    }));
    this.TotalCostOccuredThisMonth = this.piedata.reduce(
      (sum, item: any) => sum + item.y,
      0
    );
    this.title = `Total Cost Occurred This Month: ${this.TotalCostOccuredThisMonth}`;
    this.piechart?.refresh();
    this.piechart?.refreshChart();
  }
}
