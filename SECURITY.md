# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main`  | ✅ Yes    |
| older branches | ❌ No |

Only the latest code on the `main` branch receives security fixes.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities via one of the following channels:

- **GitHub Private Advisory**: [Report a vulnerability](../../security/advisories/new) (preferred)
- **Email**: security@soroban-starter-kit.dev

Include as much of the following as possible:

- A description of the vulnerability and its potential impact
- The affected contract(s) and function(s)
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations you have identified

## Response Timeline

| Milestone | Target |
|-----------|--------|
| Initial acknowledgement | Within **48 hours** |
| Triage and severity assessment | Within **5 business days** |
| Fix or mitigation published | Within **30 days** for critical/high; **90 days** for medium/low |
| Public disclosure | Coordinated with the reporter after fix is released |

We follow a **coordinated disclosure** model. We ask that you give us a
reasonable window to address the issue before any public disclosure.

## Severity Classification

We use the [CVSS v3.1](https://www.first.org/cvss/v3.1/specification-document)
scoring system to assess severity:

| Severity | CVSS Score |
|----------|-----------|
| Critical | 9.0 – 10.0 |
| High     | 7.0 – 8.9  |
| Medium   | 4.0 – 6.9  |
| Low      | 0.1 – 3.9  |

## Scope

The following are **in scope**:

- `contracts/token` — Token contract logic
- `contracts/escrow` — Escrow contract logic
- `contracts/common` — Shared library code
- CI/CD pipeline configurations that could lead to supply-chain attacks

The following are **out of scope**:

- Third-party dependencies (report those to the respective upstream maintainers)
- Issues already publicly disclosed
- Theoretical vulnerabilities without a realistic attack path

## Safe Harbour

We will not pursue legal action against researchers who:

- Report vulnerabilities in good faith through the channels above
- Do not access, modify, or exfiltrate data beyond what is needed to demonstrate the issue
- Do not disrupt production systems or other users

## Acknowledgements

We publicly thank researchers who responsibly disclose valid vulnerabilities
(with their permission) in our release notes.

---

For general security considerations and the threat model, see [`docs/security.md`](docs/security.md).
