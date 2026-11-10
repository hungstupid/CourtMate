`court-photo.jpg`: tennis-court photograph retrieved from
https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=640&q=70&fit=crop
on 2026-11-10. Local test fixture only, not a published venue record.
Serving the real JPEG from Vite makes image decoding deterministic without
intercepting image requests or depending on a third-party image host in CI.
