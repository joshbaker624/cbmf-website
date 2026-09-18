# Charlotte Baker Memorial Fund — Website

Static website for the Charlotte Baker Memorial Fund, Inc. (501(c)(3), EIN 88-3524209), a Pink Hill, NC nonprofit helping ALS patients and their families. It replaces the Google Sites page at cbmemorialfund.com.

No build step and no dependencies: plain HTML, CSS and JavaScript.

## Pages

| File | Page |
|---|---|
| `index.html` | Home: sunrise hero, mission, impact numbers, how gifts help, Charlotte's story, ALS facts, Memorial Weekend, news, donate call-to-action |
| `story.html` | Charlotte's story, timeline, the meaning of the logo, board |
| `events.html` | Memorial Weekend: save-the-date, event lineup, past weekends, ways to get involved |
| `news.html` | Press coverage (WNCT, Neuse News) |
| `donate.html` | Donate (Square link), where the money goes, other ways to give, donor FAQ |

## Preview locally

```sh
cd ~/Desktop/"CBMF website"
python3 -m http.server 8765
# open http://localhost:8765
```

## Where things live

- `assets/css/styles.css`: all styles. Colors, fonts and spacing are CSS variables at the top of the file.
- `assets/js/main.js`: sticky header, mobile menu, scroll reveals, count-up numbers.
- `assets/img/`: logo (transparent cutout), favicons, and photos (WebP).
- `_source/`: the raw pages and images downloaded from the old Google Site, kept for reference. Don't deploy this folder.

The header, footer and closing call-to-action are repeated in each HTML file. If you change a nav link or footer line, change it in all five pages.

## Key links (search and replace these if they change)

- Donate (Square): `https://square.link/u/OLcaDC5I`
- Facebook: `https://www.facebook.com/CBakerSoftballTournament/`

## To-do before launch

- [x] ~~Add a photo of Charlotte~~ (done: `assets/img/charlotte.jpg` / `.webp`, shown in the homepage "Her story" section).
- [ ] **Memorial Weekend 2026 dates.** `events.html` currently says "Save the date" and points people to Facebook. Add the real dates and locations once they're set.
- [ ] **Board list and titles.** These come from the 2022 Neuse News article (all shown as "Board Member"). Confirm names and add titles (President, Treasurer, etc.).
- [ ] **Contact email / mailing address.** There's no email or mailing address yet, so every "reach out" button goes to Facebook. Add an email (and a check-mailing address on the donate page) if you want one.
- [ ] More event photos would make the Memorial Weekend page even stronger.

## Deploying

Any static host works: Netlify, Cloudflare Pages, GitHub Pages, or Vercel. Upload everything except `_source/` and `README.md`, then point the `cbmemorialfund.com` DNS at the host instead of Google Sites.
