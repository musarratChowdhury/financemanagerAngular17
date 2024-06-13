import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  public routeList: any[] = [
    {
      serial: 1,
      text: 'Dashboard',
      submenu: false,
      routerLink: '/dashboard',
    },
    {
      serial: 2,
      text: 'Expense',
      submenu: true,
      submenuList: [
        {
          text: 'Expense Table',
          routerLink: '/expense-table',
        },
        {
          text: 'Expense Form',
          routerLink: '/expense-form',
        },
      ],
    },
    {
      serial: 3,
      text: 'Expense Category',
      submenu: false,
      routerLink: '/expense-category',
    },
    {
      serial: 4,
      text: 'Receipt',
      submenu: false,
      routerLink: '/receipt',
    },
  ];
}
