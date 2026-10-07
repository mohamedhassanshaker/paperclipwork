Scratch file for TAH-33 acceptance-criterion demo: proves a planted secret
turns the `secret scan` CI job — and the overall workflow — red now that
`continue-on-error` has been removed. The value below is a randomly
generated, non-functional string shaped to match gitleaks' generic
high-entropy secret heuristic — not a credential for any real account or
service. Delete this file/branch once the run has been observed; it is not
meant to merge.

app_secret_token = "Z3kZxraaEdpDrTeWgPSbPesbiWRX4vyUUKxig"
