import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { registerLicense } from '@syncfusion/ej2-base';

registerLicense(
  "Ngo9BigBOggjHTQxAR8/V1NGaF1cVWhIfEx1RHxQdld5ZFRHallYTnNWUj0eQnxTdEZjUX5ecHNVRWNVVUV1Xw=="
);

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", function() {
  // Get the element by its style attribute
  var element:HTMLElement|null = document.querySelector('div[style*="position: fixed"]');

  // Check if the element exists
  if (element) {
    // Hide the element by setting its display to none
    element.style.display = "none";
  }
});

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
