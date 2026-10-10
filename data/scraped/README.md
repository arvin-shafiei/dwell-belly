# Web-grounded scenario seeds

`seeds-web.json` holds 123 anonymised scenario seeds for the delivery coordination agent, written on 2026-10-10 from public complaint pages so the test set is not shaped only by the organisers' practice cases.

**Sites read (page loads):** Sitejabber / smartcustomer.com carrier, meal kit, freight marketplace, food gift and furniture retailer reviews (7); ProductReview.com.au grocery, meal kit, freight broker, international shipping and bulky freight reviews (7, one a 404); Reviews.io carrier reviews (6, three were 404s); UK Business Forums import and courier threads (5); one haulier knowledge page on tail-lift unloading and one pallet network FAQ (1 each); DuckDuckGo HTML search to find threads (3).

**Blocked or skipped:** Trustpilot (bot check, 403), Reddit via old.reddit.com (login wall), ConsumerAffairs (access denied), Singletrack forum (bot check shown, page not read), MoneySavingExpert (bot check on its search page; the 4 seeds read from its threads were removed afterwards, along with 2 others specific enough for the original poster to recognise).

**Anonymisation rules:** public pages only, no logins, no captchas or paywalls. No names, usernames, tracking or order numbers, addresses, phone numbers or emails. No copied sentences: every seed is a neutral rewrite. Carrier and merchant brands are left out of the seed text, and places, dates and amounts are generalised. `source` names the site and page type, never an individual post.

**Caveats:** the four seeds whose source is a haulier knowledge page are constructed from published unloading rules, not from a complaint. The sources skew to UK, US and Australian consumers. Parcel carrier complaints are over-represented against freight and cold chain.

**Seed shape:** `id` (`seed-web-NNN`), `source`, `area` (one of: slot change, address, access, missed or failed delivery, damage, lost or misdelivered, cold chain, returns and labels, pallet and freight, customs and import charges, billing, other), `situation` (2 to 4 sentences), `parties` (array), `complication`, `tone`, `tempting_wrong_move`.
