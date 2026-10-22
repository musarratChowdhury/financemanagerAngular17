import { chromium } from '@playwright/test';

const log = (...a) => console.log(...a);

const browser = await chromium.launch();
log('browser launched');
const page = await browser.newPage({ viewport: { width: 880, height: 880 } });
const errors = []