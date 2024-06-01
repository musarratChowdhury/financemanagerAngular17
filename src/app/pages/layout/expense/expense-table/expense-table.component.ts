import { Component, OnInit } from '@angular/core';
import {
  GridModule,
  PageService,
  SortService,
  FilterService,
  GroupService,
  PageSettingsModel
} from '@syncfusion/ej2-angular-grids';
import {data} from "../../../../../Data/TestData";

@Component({
  selector: 'app-expense-table',
  standalone: true,
  imports: [
    GridModule
  ],

  providers: [PageService,
    SortService,
    FilterService,
    GroupService],
  templateUrl: './expense-table.component.html',
  styleUrl: './expense-table.component.css'
})
export class ExpenseTableComponent implements  OnInit{
  public data?: object[];
  public pageSettings?: PageSettingsModel;
  ngOnInit(): void {
    this.data = data;
    this.pageSettings = { pageSize: 6 };
  }

}
