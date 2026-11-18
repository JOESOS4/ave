# Triage label vocabulary

The five canonical triage roles used by the `triage` skill:

| Label | Purpose |
|-------|---------|
| `needs-triage` | New issue that has not yet been classified |
| `needs-info` | Waiting on additional information from the reporter |
| `ready-for-agent` | Clear, actionable, and ready for an agent to pick up |
| `ready-for-human` | Requires human judgment or decision before further work |
| `wontfix` | Intentionally declined; kept for the record |

These labels are applied by the triage state machine and read by `to-tickets`, `to-spec`, and `wayfinder`.