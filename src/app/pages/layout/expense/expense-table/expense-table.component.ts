import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {
  GridModule,
  PageService,
  SortService,
  FilterService,
  GroupService,
  PageSettingsModel,
} from '@syncfusion/ej2-angular-grids';
import { DataService } from '../../../../services/data.service';
@Component({
  selector: 'app-expense-table',
  standalone: true,
  imports: [GridModule],

  providers: [PageService, SortService, FilterService, GroupService],
  templateUrl: './expense-table.component.html',
  styleUrl: './expense-table.component.css',
})
export class ExpenseTableComponent implements OnInit {
  public data?: object[];
  public pageSettings?: PageSettingsModel;
  /**
   *
   */
  constructor(private dataService: DataService) {}
  ngOnInit(): void {
    this.pageSettings = { pageSize: 6 };
    this.dataService.getAll().subscribe({
      next: (data) => {
        this.data = data;
        console.log(data);
      },
      error: (err) => {
        console.log(err.message);
      },
    });
  }
}
