# Quiet Exit privacy

Quiet Exit processes consent interfaces locally in the browser. It does not send page content, browsing history, URLs, cookie values or usage statistics to Eric Escapes or another service. It has no analytics or remote rule downloads. Fonts and artwork are bundled.

## Permissions

- **Website access to HTTP and HTTPS pages:** needed to find and operate consent interfaces on the sites you visit, including matching frames. Browser-protected pages cannot be modified. You can restrict website access in your browser.
- **Storage:** used for the enable preference, total banners declined, and a bounded list of random event identifiers that prevents duplicate counting. Event identifiers do not contain page addresses or domain names.

The extension does not request cookies, browsing history, network interception or native messaging permissions. Its only automatic site interactions are supported consent controls. Websites may make their own requests in response to those controls, just as when you click them manually.

## Local data

Settings and aggregate counts use `storage.local`, not browser sync. Removing the extension removes its extension storage according to your browser's normal behaviour. Turning it off stops automatic interactions; it does not reverse choices already submitted to sites or erase existing cookies.

Rejecting a consent banner is not a guarantee that a website stops all tracking. Quiet Exit cannot verify a site's server-side handling of your choices.
