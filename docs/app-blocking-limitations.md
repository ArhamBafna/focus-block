# App blocking enforcement limits

FocusBlock service owns app enforcement. It stores an active-session snapshot in
`ProgramData`, rehydrates it after service or Windows restart, terminates matching
processes every 250 ms, and uses persistent Windows Filtering Platform filters at
outbound ALE connect for IPv4 and IPv6. Those identity filters cover normal
connection traffic, including TCP, UDP, QUIC, and other IP connection types, for
known executable app IDs and Microsoft Store package SIDs.

Folder targets are expanded to contained `.exe` files and rescanned every two
seconds. A newly copied executable can launch before its identity appears in WFP;
the process loop still terminates it on the next 250 ms pass. True pre-launch
denial for unknown or newly introduced processes requires excluded hard-lock,
kernel, or equivalent system-control technology, so FocusBlock does not claim it.

Protected/PPL processes can reject user-mode termination. FocusBlock still denies
their matching WFP network identity, but complete process-use denial for protected
software would require excluded protected or kernel-level control.

FocusBlock never changes DNS, proxy settings, hosts files, `netsh` IP rules, or
global firewall state. Its cleanup enumerates only filters in its own WFP provider
and sublayer; a service failure therefore cannot break general internet access.
