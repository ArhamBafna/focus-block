/// Normalize a domain for storage and matching.
pub fn normalize_domain(input: &str) -> Option<String> {
    let mut domain = input.trim().to_lowercase();
    if domain.is_empty() {
        return None;
    }
    if let Some(stripped) = domain.strip_prefix("http://") {
        domain = stripped.to_string();
    } else if let Some(stripped) = domain.strip_prefix("https://") {
        domain = stripped.to_string();
    }
    if let Some((host, _)) = domain.split_once('/') {
        domain = host.to_string();
    }
    if let Some((host, _)) = domain.split_once('?') {
        domain = host.to_string();
    }
    if let Some((host, _)) = domain.split_once('#') {
        domain = host.to_string();
    }
    if let Some((host, _)) = domain.split_once(':') {
        domain = host.to_string();
    }
    domain = domain.trim_start_matches("www.").to_string();
    if domain.is_empty() || domain.contains(' ') || !domain.contains('.') {
        return None;
    }
    Some(domain)
}

/// Returns true if `host` matches `rule` (exact or subdomain suffix).
pub fn domain_matches(host: &str, rule: &str) -> bool {
    let host = normalize_domain(host).unwrap_or_else(|| host.to_lowercase());
    let rule = normalize_domain(rule).unwrap_or_else(|| rule.to_lowercase());
    host == rule || host.ends_with(&format!(".{rule}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_urls() {
        assert_eq!(
            normalize_domain("https://www.YouTube.com/watch?v=1"),
            Some("youtube.com".into())
        );
        assert_eq!(
            normalize_domain("telepathy.com/"),
            Some("telepathy.com".into())
        );
        assert_eq!(
            normalize_domain("telepathy.com?query=1"),
            Some("telepathy.com".into())
        );
        assert_eq!(
            normalize_domain("telepathy.com#hash"),
            Some("telepathy.com".into())
        );
        assert_eq!(
            normalize_domain("http://telepathy.com:8080/path"),
            Some("telepathy.com".into())
        );
        assert_eq!(
            normalize_domain("www.telepathy.com"),
            Some("telepathy.com".into())
        );
    }

    #[test]
    fn rejects_invalid_input() {
        assert_eq!(normalize_domain(""), None);
        assert_eq!(normalize_domain("   "), None);
        assert_eq!(normalize_domain("no-dot"), None);
        assert_eq!(normalize_domain("has space.com"), None);
    }

    #[test]
    fn matches_subdomains() {
        assert!(domain_matches("m.youtube.com", "youtube.com"));
        assert!(domain_matches("www.reddit.com", "reddit.com"));
        assert!(!domain_matches("notyoutube.com", "youtube.com"));
    }
}
