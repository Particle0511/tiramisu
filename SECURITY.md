# Security policy

Tiramisu is a hackathon project that runs only against the PayPal Sandbox with fictional data.
It is not approved for real money or real customers.

## Reporting a vulnerability

Please report security issues privately by email to **YOUR-EMAIL-HERE**. Do not open a public issue.
Include what you found, how to reproduce it, and the impact. I aim to reply within 3 days.

## Design rules this project follows

- Every PayPal write needs a signed-in owner, a password re-check, and passes limits.
- The AI model has no tools and cannot act. Unsupported statements are removed before anything is sent.
- Every seller's data is isolated, in the application and in the database.
- The audit log is append-only and hash-chained.
- Secrets are only ever read from environment variables.