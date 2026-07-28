# Smart Duplicate Finder — Excel Office Add-in

A production-ready Microsoft Excel Add-in that detects **probable duplicate entries** in a selected column using fuzzy matching (Levenshtein + Jaro-Winkler). Works in both **Excel Desktop** and **Excel Online**.

---

## Features

| Feature | Details |
|---|---|
| **Fuzzy matching** | Levenshtein distance + Jaro-Winkler, combined into a weighted confidence score |
| **Smart normalization** | Trims spaces, ignores case/punctuation/accents, standardizes `&` → `and` |
| **Duplicate groups** | Clusters similar values together with a shared confidence score |
| **Explain why** | Each group shows human-readable reasons for the match |
| **Color-coded confidence** | Green (99-100%), Yellow (90-98%), Orange (80-89%), Red (<80%) |
| **Accept & Replace** | Pick a master value; all duplicates are updated automatically |
| **Undo** | One-click undo of the last replacement |
| **Progress bar** | Non-blocking async scan with live progress for large sheets |
| **Performance** | Blocking + length filtering keeps 10 k rows comfortable |
| **Scan statistics** | Rows scanned, groups found, exact/fuzzy counts, avg confidence, time taken |

---

## Folder Structure

```
SmartDuplicateFinder/
├── manifest.xml             ← Office Add-in manifest (edit URLs before use)
├── assets/
│   ├── icon-16.png
│   ├── icon-32.png
│   └── icon-80.png
├── src/
│   ├── taskpane.html        ← Main task pane UI
│   ├── taskpane.css         ← Microsoft 365-inspired styles
│   ├── taskpane.js          ← Main controller (scan, replace, undo)
│   ├── office.js            ← All Excel API interactions
│   ├── fuzzy/
│   │   ├── levenshtein.js   ← Levenshtein distance algorithm
│   │   ├── jaroWinkler.js   ← Jaro-Winkler similarity algorithm
│   │   ├── normalize.js     ← String normalization pipeline
│   │   └── scorer.js        ← Combined weighted scoring + explanations
│   ├── ui/
│   │   ├── table.js         ← Duplicate groups renderer
│   │   ├── progress.js      ← Progress bar controller
│   │   └── dialogs.js       ← Toast notifications + modal dialogs
│   └── utils/
│       └── helpers.js       ← General-purpose utilities
└── README.md
```

---

## Deployment — GitHub Pages

### Step 1 — Push to GitHub

If you cloned or downloaded this repo:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/SmartDuplicateFinder.git
git push -u origin main
```

### Step 2 — Enable GitHub Pages

1. Go to your repository on GitHub.
2. Click **Settings** → **Pages** (left sidebar).
3. Under **Source**, select **Deploy from a branch**.
4. Choose `main` branch, `/ (root)` folder.
5. Click **Save**.

GitHub will publish the site at:
```
https://YOUR-USERNAME.github.io/SmartDuplicateFinder/
```

Wait 1-2 minutes for it to go live.

### Step 3 — Update the Manifest

Open `manifest.xml` and replace **every occurrence** of:
```
https://YOUR-USERNAME.github.io/SmartDuplicateFinder
```
with your real GitHub Pages URL (keeping the path after the domain the same).

Also update `YOUR-USERNAME` in the `<SupportUrl>` and `<AppDomains>` entries.

Then commit and push the updated manifest:
```bash
git add manifest.xml
git commit -m "Update manifest URLs"
git push
```

---

## Sideloading the Add-in into Excel

### Excel Desktop (Windows)

1. Copy the **absolute path** to your local `manifest.xml` file.
2. Open Excel → **File** → **Options** → **Trust Center** → **Trust Center Settings**.
3. Click **Trusted Add-in Catalogs**.
4. In the **Catalog Url** box, enter the folder path containing `manifest.xml`.
5. Check **Show in Menu** → **Add** → **OK** → restart Excel.
6. In Excel, go to **Insert** → **My Add-ins** → find **Smart Duplicate Finder** → **Add**.

> **Shortcut (Windows):** You can also use the shared folder method — place the folder containing `manifest.xml` in a network share, then add that share URL to Trusted Catalogs.

### Excel Desktop (Mac)

1. Go to Finder and open:
   `~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/`
   (Create the `wef` folder if it doesn't exist.)
2. Copy `manifest.xml` into that folder.
3. Restart Excel.
4. In Excel, go to **Insert** → **My Add-ins** → **Smart Duplicate Finder**.

### Excel Online (Office 365)

1. Open a workbook in Excel Online.
2. Go to **Insert** → **Office Add-ins** → **Upload My Add-in**.
3. Browse to your `manifest.xml` file → **Upload**.

> Note: Excel Online requires the `SourceLocation` URL in the manifest to be an HTTPS URL. The GitHub Pages URL fulfills this requirement.

---

## Changing the Hosted URL

If you move the add-in to a different host (e.g., Azure Static Web Apps, Netlify, your own server):

1. Open `manifest.xml`.
2. Find all URLs that currently point to `https://YOUR-USERNAME.github.io/SmartDuplicateFinder`.
3. Replace them with your new base URL, keeping the paths the same.
4. Re-sideload the updated manifest.

No JavaScript files need to change — all paths are relative within the `src/` folder.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Task pane shows blank / white | Check that the GitHub Pages URL is live and accessible. Open it in a browser first. |
| "This worksheet is protected" | Unprotect the sheet before scanning (Review → Unprotect Sheet). |
| "Select a single column" | Click a cell in one column, then Ctrl+Shift+End to select the column, OR click the column letter header. |
| Add-in not appearing in Insert menu | Ensure the manifest was added to a Trusted Catalog and Excel was restarted. |
| Replacements not saving | The workbook may be in read-only mode or the sheet is protected. |
| Low match rate | Lower the confidence threshold slider. Try 70-75% for short strings or abbreviations. |
| Office.js not loading | The `https://appsforoffice.microsoft.com` script tag in `taskpane.html` requires internet access. |

---

## Extending the Add-in

- **Add more algorithms:** Create a new file in `src/fuzzy/`, export a similarity function `(a, b) => number`, and adjust the weights in `scorer.js`.
- **Persist settings:** Use `Office.context.document.settings` to save the threshold preference between sessions.
- **Multi-column scan:** Extend `office.js → readSelectedColumn()` to accept multiple columns and concatenate cell values before comparison.
- **Export results:** Use the `downloadCSV` pattern to export matched pairs to a CSV.

---

## License

MIT — see `LICENSE`.
