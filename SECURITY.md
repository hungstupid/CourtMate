# Security and secrets policy

Applies to **all project phases** and local development.

- NEVER commit passwords, credentials, API tokens, `.env` files, service-account JSON, database backups containing user data or private keys. `.env.example` may list **placeholder names only**.
- Store secrets in the hosting platform's secret manager / GitHub Actions Secrets when infrastructure is approved. Never paste secrets into Issues, PRs, screenshots, demos or AI chats.
- Use environment variables for API/database connections; use separate development and production credentials.
- Review and validate user input; hash passwords; enforce role-based authorization and court ownership checks on the server.
- Report suspected leaks privately to the Team Lead and TA. Revoke/rotate the secret immediately and assess Git history; deleting a file alone is not enough.
- Use fictional/test accounts in documentation and demos. Do not put real customer or member confidential data in the public repo.
- Changes to authentication, booking conflict prevention and sensitive configuration require review and tests.

This policy is preparation only; it does not claim that security controls have been implemented.
