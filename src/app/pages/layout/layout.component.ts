import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../reusables/sidebar/sidebar.component';
import { TabBarComponent } from '../reusables/tabbar/tabbar.component';

/**
 * App shell.
 *
 * Mobile-first: the bottom tab bar is the primary navigation on phones, the
 * dark rail takes over from 1024px. Both are always in the DOM — CSS decides
 * which one is visible, so there is no resize listener to get wrong.
 */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TabBarComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent {}
