import { Component } from '@angular/core';
import { GridModule } from '@syncfusion/ej2-angular-grids';

@Component({
  selector: 'app-current-needs',
  standalone: true,
  imports: [GridModule],
  templateUrl: './current-needs.component.html',
  styleUrl: './current-needs.component.css',
})
export class CurrentNeedsComponent {
  /**
   *
   */
  constructor() {}
}
