# Scripts — all phases

Store **repeatable**, documented scripts for local setup, checks, fixtures, migrations, test execution or packaging once they are needed.

For each script add:
- Purpose / expected output.
- Supported environment, prerequisites and exact command.
- Whether it changes files, data or external services (and any recovery steps).
- Link to the relevant task, phase and maintainer.

Avoid destructive defaults, hard-coded secrets, operations that delete another member's data, and one-off scratch code. Keep test scripts next to the application or under `docs/test/` when appropriate. This README alone does not imply scripts exist.
