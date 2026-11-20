import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../reusables/sidebar/sidebar.component';
import { TabBarComponent } from '../reusables/tabbar/tabbar.component';
import { ReceiptModelService } from '../../services/receipt-model.service';

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
export class LayoutComponent implements OnInit {
  private readonly receiptModels = inject(ReceiptModelService);

  ngOnInit(): void {
    // Delayed so the first screen gets the network to itself. The account-wide
    // model choice is fetched first (localStorage is only a cache), then the
    // background sweep decides whether that model can actually read a receipt.
    // The sweep itself is cached server-side for ten minutes, so it is cheap on
    // every later sign-in.
    setTimeout(() => void this.startup(), 2000);
  }

  private async startup(): Promise<void> {
    await this.receiptModels.loadFromServer();
    await this.receiptModels.runSweep();
  }
}
