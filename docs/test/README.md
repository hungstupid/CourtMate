# Testing and quality — all phases

Maintain the **living verification assets**: PA4 test plan, cases and datasets, equivalence partitioning (EP), boundary value analysis (BVA), decision tables, traceability to requirements, automated test plans, actual execution logs, coverage and defect tracking evidence.

- PA1–PA3: identify testability and risks; don't fabricate test executions.
- PA4: define scope, levels, techniques, entry/exit criteria and repeatable tests for all Must-have requirements.
- PA5: run tests, log **actual vs expected**, capture defects/ret tests, unit/integration results, CI links, coverage and deployment smoke tests.

Store only anonymized/fake test data. Link defects to GitHub Issues and their fixing PRs. Automated tests remain near frontend/backend source as appropriate; this directory references and reports them.

**Never** mark a test `Pass` or cite coverage until there is actual evidence.
