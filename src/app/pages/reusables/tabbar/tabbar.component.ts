import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface TabItem {
  label: string;
  link: string;
  path: string;
}

/**
 * Mobile bottom navigation, matching the mobile frames of the design.
 *
 * Five slots with the receipt scanner lifted into the centre as a lime FAB —
 * that is the single most frequent action in a savings-first app, so it gets
 * the thumb zone rather than a menu entry.
 */
@Component({
  selector: 'app-tabbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './tabbar.component.html',
  styleUrl: './tabbar.component.css',
})
export class TabBarComponent {
  readonly tabs: TabItem[] = [
    {
      label: 'Home',
      link: '/dashboard',
      path: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    },
    {
      label: 'Expenses',
      link: '/expenses',
      path: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
    },
    {
      label: 'Categories',
      link: '/categories',
      path: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
    },
    {
      label: 'Cash flow',
      link: '/cash-flow',
      path: 'M22 12h-4l-3 9L9 3l-3 9H2',
    },
  ];
}
