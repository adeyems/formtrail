# FormTrail

A small Node.js runner for authored journeys against trusted, synthetic HTML form fixtures. It launches a fresh headless Chromium session for each run using the [Playwright library](https://playwright.dev/docs/api/class-playwright).

Requires Node 22 or newer.

```sh
npm ci
npx playwright install chromium
node formtrail.js examples/signup.html examples/signup.json
npm test
npm run check
```

The example tests browser email validation, fills a synthetic address and verifies a local submit handler's success message. It sends no form data to a server. Reports contain step numbers, action names and pass/fail results, without entered values or page text. Exit codes: 0 all steps passed, 1 a step failed, 2 input or browser setup failure.

## Journey version 1

An object with exactly `version: 1` and `steps`, containing 1–50 ordered actions:

- `fill`: `selector` and string `value`.
- `click`: `selector`.
- `text`: `selector` and exact visible-text `value`.
- `invalid`: `selector`; checks native `checkValidity()` returns false.

Selectors use Playwright locator syntax and must resolve unambiguously. Each action has a two-second default timeout. Text assertions check the current text after visibility; they do not retry an asynchronous text change. The first failed step stops the journey. A valid-input check is not inferred from text success: author explicit checks relevant to the form.

Each input file is capped at 256 KiB and must be UTF-8. Selectors are limited to 500 characters and values to 4096. JSON uses Node's ordinary parser (duplicate keys take their last value). Each run uses a new browser context; fixtures cannot rely on previous cookies or browser storage.

## Boundaries

Fixtures are loaded into a blank page, with HTTP requests aborted, WebSockets closed and service workers blocked. External assets will not load. Use self-contained, trusted synthetic fixtures. These measures are not a security sandbox for hostile HTML, JavaScript or selectors. Do not use account credentials or customer data. Popup, download and real server-submission workflows are unsupported. A passing journey only proves its authored assertions; a blocked request alone does not fail it. No network-completeness, accessibility-compliance or whole-form correctness claim is made.

This is one small first milestone. Multi-page navigation, branching, keyboard journeys, saved-run comparisons and richer diagnostics remain unimplemented. Feature work stops here pending owner review. A new repository and passing tests do not establish programme eligibility or sufficient development history.
