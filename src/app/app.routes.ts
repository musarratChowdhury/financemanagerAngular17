import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { PageNotFoundComponent } from './pages/page-not-found/page-not-found.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/layout/dashboard/dashboard.component';
import { ExpenseCategoryComponent } from './pages/layout/expense-category/expense-category.component';
import { ExpenseComponent } from './pages/layout/expense/expense.component';
import { ExpenseTableComponent } from './pages/layout/expense/expense-table/expense-table.component';
import { ReceiptComponent } from './pages/layout/receipt/receipt.component';
import { authGuard } from './auth.guard';
import { NavbarComponent } from './pages/reusables/navbar/navbar.component';
import { CurrentNeedsComponent } from './pages/layout/current-needs/current-needs.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    title: 'Login Page',
    component: LoginComponent,
  },
  {
    path: 'navbar',
    title: 'navbar',
    component: NavbarComponent,
  },
  {
    path: 'register',
    title: 'Register Page',
    component: RegisterComponent,
  },
  {
    path: '',
    component: LayoutComponent,
    title: 'Layout',
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        component: DashboardComponent,
      },
      {
        path: 'expense-category',
        title: 'Expense-Category',
        component: ExpenseCategoryComponent,
      },
      {
        path: 'expense',
        title: 'Expense',
        component: ExpenseComponent,
      },
      {
        path: 'expense-table',
        title: 'ExpenseTable',
        component: ExpenseTableComponent,
      },
      {
        path: 'receipt',
        title: 'Receipt',
        component: ReceiptComponent,
      },
      {
        path: 'current-needs',
        title: 'CurrentNeeds',
        component: CurrentNeedsComponent,
      },
    ],
  },

  { path: '**', component: PageNotFoundComponent },
];
