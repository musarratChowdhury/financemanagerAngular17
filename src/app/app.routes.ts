import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { PageNotFoundComponent } from './pages/page-not-found/page-not-found.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/layout/dashboard/dashboard.component';
import { CategoriesComponent } from './pages/layout/expense-category/categories.component';
import { ExpensesComponent } from './pages/layout/expense/expenses.component';
import { ScanReceiptComponent } from './pages/layout/receipt/scan-receipt.component';
import { authGuard } from './auth.guard';
import { NavbarComponent } from './pages/reusables/navbar/navbar.component';
import { CurrentNeedsComponent } from './pages/layout/current-needs/current-needs.component';
import { CashFlowComponent } from './pages/layout/cash-flow/cash-flow.component';
import { EnvelopesComponent } from './pages/layout/envelopes/envelopes.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    title: 'Sign in · Save Your Penny',
    component: LoginComponent,
  },
  {
    path: 'register',
    title: 'Create account · Save Your Penny',
    component: RegisterComponent,
  },
  {
    path: 'navbar',
    title: 'navbar',
    component: NavbarComponent,
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard · Save Your Penny',
        component: DashboardComponent,
      },
      {
        path: 'expenses',
        title: 'Expenses · Save Your Penny',
        component: ExpensesComponent,
      },
      {
        path: 'categories',
        title: 'Categories · Save Your Penny',
        component: CategoriesComponent,
      },
      {
        path: 'scan-receipt',
        title: 'Scan receipt · Save Your Penny',
        component: ScanReceiptComponent,
      },
      {
        path: 'cash-flow',
        title: 'Cash flow · Save Your Penny',
        component: CashFlowComponent,
      },
      {
        path: 'current-needs',
        title: 'Current needs · Save Your Penny',
        component: CurrentNeedsComponent,
      },
      {
        path: 'envelopes',
        title: 'Envelope budget · Save Your Penny',
        component: EnvelopesComponent,
      },

      // ---------------------------------------------------------------------
      // Old URLs. The redesign merged the expense form, the expense table and
      // the receipt builder into single screens, so these redirect rather than
      // 404 on any bookmark or link that still points at them.
      // ---------------------------------------------------------------------
      { path: 'expense', redirectTo: 'expenses', pathMatch: 'full' },
      { path: 'expense-table', redirectTo: 'expenses', pathMatch: 'full' },
      { path: 'expense-category', redirectTo: 'categories', pathMatch: 'full' },
      { path: 'receipt', redirectTo: 'scan-receipt', pathMatch: 'full' },
    ],
  },

  { path: '**', component: PageNotFoundComponent },
];
