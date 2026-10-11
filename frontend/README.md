# Frontend — guidance for every PA

**Purpose:** frontend application code and assets for the web browser. The **technology choice is provisional** (React suggested in PA0).

Place here **when approved/implemented**:
- `src/`: pages/views, reusable UI components, state/hooks, form validation, route guards.
- `public/` or `assets/`: local static assets with appropriate licenses.
- `tests/`: frontend unit/component tests if the selected tooling uses this layout.
- `package.json`, configuration and `.env.example`: dependencies and non-secret environment variable names.

**Do not place here:** PA submission PDFs, use-case specifications, architecture diagrams or real secrets. Put course artifacts in `docs/` and `pa/`.

**Cross-phase workflow:** PA2 requirements → PA3 designs → PA4 test cases → PA5 implementation and test evidence. Include setup/run/test/build commands here **once real tooling is selected**; do not present speculative commands as working.

Every change: approved Issue → branch → PR → review → merge. Link UI screens back to use cases and tests.
