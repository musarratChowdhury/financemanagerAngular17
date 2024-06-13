import { Component, OnInit, ViewChild } from '@angular/core';
import { DataManager, WebApiAdaptor } from '@syncfusion/ej2-data';
import {
  EditService,
  FilterService,
  GridComponent,
  GridModule,
  GroupService,
  PageService,
  SortService,
  ToolbarService,
} from '@syncfusion/ej2-angular-grids';
import { ExpenseCategoryService } from '../../../services/expense-category.service';

@Component({
  selector: 'app-expense-category',
  standalone: true,
  imports: [GridModule],
  providers: [
    PageService,
    SortService,
    FilterService,
    GroupService,
    ToolbarService,
    EditService,
  ],
  templateUrl: './expense-category.component.html',
  styleUrl: './expense-category.component.css',
})
export class ExpenseCategoryComponent implements OnInit {
  @ViewChild('grid')
  public grid?: GridComponent;
  public data: any;
  public toolbar: string[];
  public editSettings: Object;
  public nameEditRules: Object;
  public pageSettings = { pageSize: 10 };
  /**
   *
   */
  constructor(private dataService: ExpenseCategoryService) {
    this.toolbar = ['Add', 'Edit', 'Delete', 'Update', 'Cancel'];
    this.editSettings = {
      allowEditing: true,
      allowAdding: true,
      allowDeleting: true,
    };
    this.nameEditRules = { required: true };
  }
  ngOnInit(): void {
    console.log(this.grid);
    this.dataService.getAll().subscribe({
      next: (data) => {
        this.data = data;
      },
      error: (err) => console.log(err),
    });
  }
}
