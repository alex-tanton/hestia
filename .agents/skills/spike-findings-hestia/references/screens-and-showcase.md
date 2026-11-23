# Feature Area: Screens & Showcase

Implementation patterns, constraints, and antipatterns established in Spikes 004, 005, and 006.

## Requirements

- Provide high-resolution visual screenshots for review at each stage without requiring the user to deploy or run the frontend locally.
- Full screen visual harmony across all application pillars (Dashboard, Shopping List, Bills, Meals, Chores).

## How to Build It

1. **Automated Headless Chrome Screenshot Pipeline:**
   - Execute Chrome in headless mode with PowerShell `Start-Process`:
     ```powershell
     Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList @(
       "--headless=new",
       "--disable-gpu",
       "--force-device-scale-factor=1",
       "--screenshot=$outputPath",
       "--window-size=$windowSize",
       "$htmlFileUrl"
     ) -Wait
     ```
   - Standard resolutions:
     - Desktop: `1440,960` or `1200,900`
     - Mobile: `420,920` (centered viewport frame)
2. **Artifact Delivery:**
   - Write screenshots directly to the session artifact directory (`<appDataDir>/brain/<conversation-id>/`).
   - Create or update a markdown review artifact linking and embedding the PNGs.
   - Point the user to the visual artifact for immediate review without context window clutter.
3. **Screen Layout Patterns:**
   - **Dashboard:** 2-column or 3-column CSS Grid of filled cards (Bills, Shopping, Meals, Chores).
   - **Bills:** Status chips (Paid, Overdue, Upcoming), grouped list rows with currency formatting.
   - **Shopping:** Category-grouped lists with checkbox states and strike-through completed text.
   - **Meals:** Day-of-week meal plan cards with recipe tags.
   - **Floating Action Button (FAB):** Fixed 56x56dp or extended pill at bottom right, elevation level 3, `primary-container` background.

## What to Avoid

- **Do not ask user to deploy or preview:** The user specified they must not be required to run or deploy the app to review UI changes.
- **Avoid PowerShell quoting bugs:** Always use array argument lists with `Start-Process` rather than a single quoted command line to avoid URL/argument mangling.
