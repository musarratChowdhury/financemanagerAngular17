import { Component, OnInit, ViewChild } from '@angular/core';
import {
  DataSourceChangedEventArgs,
  DataStateChangeEventArgs,
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
import { ActionBeginEventArgs } from '@syncfusion/ej2-angular-dropdowns';
import { ActionCompleteEventArgs } from '@syncfusion/ej2-angular-inputs';
import { ExpenseCategory } from '../../../../models/ExpenseCategory';

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
    this.dataService.getAll().subscribe({
      next: (data) => {
        this.grid!.dataSource = data;
      },
      error: (err) => console.log(err),
    });
  }
  public dataStateChange(state: DataStateChangeEventArgs): void {
    const query = (this.grid as GridComponent).getDataModule().generateQuery();
    // this.crudService.execute(state, query);
  }

  public actionBeginHandler(event: ActionBeginEventArgs) {
    console.log(event);
  }
  public actionCompleteHandler(event: any) {
    console.log(event);
    if (event.action == 'add' && event.requestType == 'save') {
      console.log('Add Event', event.data);
      let newCategory = new ExpenseCategory(
        0,
        event.data.name,
        new Date().getUTCDate().toString(),
        ''
      );
      this.dataService.create(newCategory).subscribe({
        next: (res) => {
          this.grid?.refresh();
          // console.log(res);
        },
        error: (err) => console.log(err),
      });
    } else if (event.action == 'edit' && event.requestType == 'save') {
      console.log('Edit Event', event.data);
      let editedCategory = new ExpenseCategory(
        event.data.id,
        event.data.name,
        event.data.entryDate,
        event.data.createdBy
      );
      this.dataService.update(event.data.id, editedCategory).subscribe({
        next: (res) => {
          this.grid?.refresh();
          // console.log(res);
        },
        error: (err) => console.log(err),
      });
    } else if (event.requestType == 'delete') {
      console.log('Delete triggered');
    }
  }

  public dataSourceChanged(state: DataSourceChangedEventArgs): void {
    console.log(state);
    switch (state.action || state.requestType) {
      case 'add':
        {
          console.log('add');
          // this.crudService.addRecord(state).subscribe(() => {
          //   (state as GridComponent).endEdit();
          // });
        }
        break;
      case 'edit':
        {
          console.log('edit');

          // this.crudService.updateRecord(state).subscribe(() => (state as GridComponent).endEdit());
        }
        break;
      case 'delete':
        {
          console.log('delete');

          // this.crudService.deleteRecord(state).subscribe(() => {
          //   (state as GridComponent).endEdit();
          // });
        }
        break;
    }
  }
}
