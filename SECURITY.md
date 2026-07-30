# Security policy

## Supported version

Security fixes are applied to the latest release on `main`.

## Reporting

Do not open a public issue for a suspected vulnerability or include credentials,
tokens, private prompts, or user data in a report. Use GitHub's private
vulnerability reporting for this repository.

Include the affected version, a minimal reproduction, impact, and any proposed
mitigation. Remove secrets and personal data from logs before attaching them.

## Occult trust boundary

Occult is disabled by default. Agents Council accepts only the versioned,
validated contract and retains sanitized reading state. Provider credentials
remain in Hermes and must never enter Council state, logs, artifacts, or release
packages.
