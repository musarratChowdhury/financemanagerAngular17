---
name: angular-syncfusion-forms
description: Debug and replace Syncfusion ej2-angular form components (DropDownList, NumericTextBox, DatePicker, ComboBox) in Angular apps. Use when an ngModel or formControlName binding on an ejs- component silently does nothing, when a submit button stays disabled, or when asked to swap Syncfusion inputs for native HTML. Covers the empty ControlValueAccessor stubs, blur-only change events, hidden mirror inputs and the native select replacement.
compatibility: opencode
metadata:
  stack: angular
  library: "@syncfusion/ej2-angular-*"
---

## What I do

Syncfusion's Angular wrappers look like ordinary Angular form controls but are
not reliably wired to `ngModel`. This skill explains the three traps, how to
prove which one you are hitting, and how to replace a component with a native
element that behaves.

## Trap 1 — the ControlValueAccessor is an empty stub

`@syncfusion/ej2-angular-*` components register `NG_VALUE_ACCESSOR`, but the
wrapper's `registerOnChange()` / `writeValue()` are **empty bodies**:

```js
// node_modules/@syncfusion/ej2-angular-dropdowns/esm2020/src/drop-down-list/dropdownlist.component.mjs
registerOnChange(registerFunction) {
}
writeValue(value) {
}
```

So `[(ngModel)]="categoryId"` on `<ejs-dropdownlist>` compiles, renders, and
**never writes anything back**. No console error, no exception — the field just
stays at its initial value forever. Any `[disabled]` bound to that field then
stays disabled.

The same shape appears in the other wrappers (autocomplete, combo-box,
multi-select, list-box, drop-down-tree) and in the calendar/inputs wrappers.

**Before trusting any `[(ngModel)]` / `formControlName` on an ejs- component,
open its `.mjs` and check whether `registerOnChange` has a body.** If it is
empty, the binding is a no-op.

### Prove it

```ts
// dev build only - window.ng does not exist in production
const inst = (window as any).ng.getComponent(document.querySelector('ejs-dropdownlist'));
console.log(inst.value, inst.text);   // stays null / '' after a real click
```

If `inst.value` is null after the user picked an item, the CVA is the problem —
not your change detection.

## Trap 2 — `change` fires on blur, not on input

`ejs-numerictextbox` and `ejs-datepicker` emit `change` only when the field
loses focus. A template that only listens to `(change)` sees nothing while the
user is still typing, and a Playwright `fill()` never reaches the component.

```ts
await qty.fill('3');
await qty.press('Tab');     // <- the blur is what fires `change`
```

## Trap 3 — each numeric textbox renders a hidden mirror input

The component's host contains the visible `input.e-numerictextbox` **and** a
hidden `input.e-numeric-hidden` (used to carry the ngModel value). A selector
like `#ex-qty input` matches both → Playwright strict-mode violation.

```ts
const qty = page.locator('#ex-qty input.e-numerictextbox');   // the visible one
```

## The fix — native elements

A native `<select>` with `[(ngModel)]` and `[ngValue]` works correctly and is
what the app now uses for every category picker:

```html
<select id="ex-cat" class="syp-select" style="width: 100%" [(ngModel)]="categoryId">
  <option [ngValue]="null">Select a category</option>
  @for (cat of categories(); track cat.id) {
    <option [ngValue]="cat.id">{{ cat.name }}</option>
  }
</select>
```

- `[ngValue]` (not `value`) keeps the bound value's real type — `categoryId`
  stays a `number`, it does not become a string.
- The placeholder option uses `[ngValue]="null"` so the initial value matches.
- In a reactive form, `formControlName` + a plain `value` attribute gives you a
  string; `parseInt()` it if the API wants a number.

Then remove the module from the component's `imports` array, drop the package
from `package.json`, and delete the matching CSS import — the `ej2-dropdowns`
stylesheet is ~380 kB of the bundle.

## If you must keep a Syncfusion control

Use its `value` / `valueChange` two-way pair instead of `ngModel` — that pair is
wired up by `addTwoWay()` in the wrapper and does work:

```html
<ejs-dropdownlist [dataSource]="items" [fields]="{ text: 'name', value: 'id' }"
                  [(value)]="categoryId"></ejs-dropdownlist>
```

## Also check

- A `computed()` signal that reads **plain class fields** caches its first
  result forever. If a form's enable/disable logic is a `computed()`, either
  make the fields signals or use a plain getter (default change detection
  re-evaluates getters on every cycle).
