import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { PageNotFoundComponent } from './pages/page-not-found/page-not-found.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/layout/dashboard/dashboard.component';
import { ExpenseCategoryComponent } from './pages/layout/expense-category/expense-category.component';
import { ExpenseComponent } from './pages/layout/expense/expense.component';

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
    path: 'register',
    title: 'Register Page',
    component: RegisterComponent,
  },
  {
    path: '',
    component: LayoutComponent,
    title: 'Layout',
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
    ],
  },

  { path: '**', component: PageNotFoundComponent },
];
