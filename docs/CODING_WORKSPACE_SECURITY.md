# Coding Workspace Security

Code submissions are stored and marked `queued`; the FastAPI process never executes learner code.

Production evaluation must run in isolated workers with:

- Per-submission ephemeral containers
- No host filesystem access
- No network access by default
- CPU, memory, process, and wall-clock limits
- Read-only runtime images
- Language-specific compiler images
- Output size limits and secret redaction
- Queue-level retries and dead-letter handling
- Submission and result audit events

The current API intentionally stops at the queue boundary. A worker implementation must be added before enabling code execution for users.
