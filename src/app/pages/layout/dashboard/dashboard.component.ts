import { Component, OnInit } from '@angular/core';
import {
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
        console.log(this.TotalCostOccuredThisMonth);
      },
      error: (err) => console.log(err),
    });

    // this.piedata = [
    //   { x: 'Jan', y: 3, text: 'Jan: 3' },
    //   { x: 'Feb', y: 3.5, text: 'Feb: 3.5' },
    //   { x: 'Mar', y: 7, text: 'Mar: 7' },
    //   { x: 'Apr', y: 13.5, text: 'Apr: 13.5' },
    //   { x: 'May', y: 19, text: 'May: 19' },
    //   { x: 'Jun', y: 23.5, text: 'Jun: 23.5' },
    //   { x: 'Jul', y: 26, text: 'Jul: 26' },
    //   { x: 'Aug', y: 25, text: 'Aug: 25' },
    //   { x: 'Sep', y: 21, text: 'Sep: 21' },
    //   { x: 'Oct', y: 15, text: 'Oct: 15' },
    //   { x: 'Nov', y: 9, text: 'Nov: 9' },
    //   { x: 'Dec', y: 3.5, text: 'Dec: 3.5' },
    // ];
    this.primaryXAxis = {
      valueType: 'Category',
      title: 'Months',
    };
    this.barChartData = [
      { x: 'A', y: 100 },
      { x: 'B', y: 300 },
      { x: 'C', y: 900 },
      { x: 'D', y: 200 },
      { x: 'E', y: 100 },
      { x: 'F', y: 600 },
    ];
    this.datalabel = { visible: true };
    this.legendSettings = {
      visible: true,
    };
    this.tooltip = {
      enable: true,
    };
    this.title = `Total Cost Occured This month : ${this.TotalCostOccuredThisMonth}`;
  }
}
