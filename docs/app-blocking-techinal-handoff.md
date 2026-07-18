\# Architecture Handoff \& Redesign Proposal



This document outlines the current state of the FocusBlock application's network-level blocking, the fundamental reasons it is currently failing, and robust alternative architectures to implement true distraction blocking on Windows.



\---



\## 1. How the Current Architecture Works



The current application attempts to block websites using two concurrent mechanisms at the OS level:



\### Mechanism A: Local DNS Proxy

1\. When a session starts, the app launches a local UDP server on `127.0.0.1:53` (a DNS proxy).

2\. It executes a PowerShell command (`Set-DnsClientServerAddress`) to forcefully change the user's Wi-Fi adapter DNS settings to point to `127.0.0.1`.

3\. \*\*Intent:\*\* When the user navigates to a website, Windows asks the local proxy for the IP. If the domain is blocked, the proxy returns a "sinkhole" response (0.0.0.0), breaking the site.



\### Mechanism B: Windows Filtering Platform (WFP) via `netsh`

1\. Before starting the DNS proxy, the app resolves the target domains (e.g., `youtube.com`) to their numerical IP addresses using standard OS lookups.

2\. It executes `netsh advfirewall firewall add rule ... action=block` to create Windows Defender Firewall rules blocking outbound traffic to those specific IP addresses.

3\. \*\*Intent:\*\* Even if the DNS is cached or bypassed, the outbound TCP connection to the server's IP is dropped by the OS firewall.



\---



\## 2. Why the Current Architecture Fails



Based on a thorough technical audit, we can confirm with 100% confidence that the current approach is fundamentally flawed and unreliable for modern web browsers.



\### Flaw 1: The "Secure DNS" (DoH) Bypass

Modern browsers (Chrome, Edge, Firefox, Brave) have \*\*DNS-over-HTTPS (DoH)\*\* enabled by default.

\* DoH encrypts DNS lookups and sends them directly to servers like Google (8.8.8.8) or Cloudflare (1.1.1.1) over standard HTTPS web traffic.

\* \*\*The Result:\*\* The browser completely ignores the Windows Wi-Fi DNS setting (`127.0.0.1`). The local DNS proxy is never queried, rendering Mechanism A useless.



\### Flaw 2: The CDN Rotating IP Problem

Modern distracting websites (YouTube, Reddit, Instagram) are hosted on massive Content Delivery Networks (CDNs) with hundreds of rotating IP addresses.

\* Mechanism B resolves the domain once and blocks a handful of IPs via the Windows Firewall.

\* \*\*The Result:\*\* The browser bypasses the DNS block via DoH, gets a \*different\* IP address for YouTube from the CDN, and connects successfully. The firewall rule is useless because the IP changed.



\### Flaw 3: Brittle OS State (The "No Internet" Bug)

Modifying the user's OS network adapter settings is highly volatile. If the FocusBlock background service crashes, is forcefully closed via Task Manager, or fails during shutdown:

\* The Wi-Fi adapter's DNS remains permanently stuck pointing to `127.0.0.1`.

\* Because the local proxy is dead, \*\*all internet access on the machine breaks\*\* until the user manually digs into Windows Settings to reset their DNS to automatic (DHCP).

