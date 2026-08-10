const domainElement = document.getElementById("blocked-domain");
const goBackButton = document.getElementById("go-back");

try {
  const urlParam = new URLSearchParams(window.location.search).get("url");
  const referrer = urlParam || document.referrer;
  if (referrer && domainElement) {
    const url = new URL(referrer);
    domainElement.textContent = url.hostname.replace(/^www\./, "");
  }
} catch {
  // Keep fallback text when browser does not expose a usable referrer or param.
}

goBackButton?.addEventListener("click", () => {
  history.back();
});
