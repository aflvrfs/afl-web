# SHK Pro – React Native / Expo (iOS)

Native iOS app for heating and plumbing businesses, rebuilt from the SwiftUI version.
React Native + Expo + TypeScript. No WebView, no HTML – every screen uses native components
(native stack navigation with large titles and search bars, UISegmentedControl, native date pickers,
iOS action sheets, alerts, share sheet, Face ID).

All files sit in one flat folder on purpose, so you can upload them to GitHub straight from an iPhone.

## Run it on your iPhone (no Mac, no PC)

You need: the **Expo Go** app (App Store), a free **GitHub** account and a free **Expo** account.

1. **Unzip**: In the Files app, tap `SHK-Pro-Expo.zip` – a folder appears.
2. **Create a GitHub repository**: In Safari open github.com → "+" → *New repository* →
   name `shk-pro`, visibility **Public** → *Create repository*.
3. **Upload the files**: In the new repo tap *uploading an existing file* (or *Add file → Upload files*),
   choose all files from the unzipped folder (select all), then *Commit changes*.
4. **Open in Snack**: In Safari go to `snack.expo.dev`, sign in with your Expo account,
   open the menu (☰) → *Import git repository* → paste `https://github.com/<your-name>/shk-pro` → *Import*.
   If Snack asks to fix dependency versions, accept. Then *Save*.
5. **Launch**: Open Expo Go, sign in with the same Expo account. The saved Snack appears in the list –
   tap it. (Alternatively: on the Snack page tap *Run* → *My Device* → *Open in Expo Go*.)

## Run it with a computer (optional)

```bash
npm install
npx expo install --fix   # aligns all package versions with the installed Expo SDK
npx expo start --tunnel  # scan the QR code with the iPhone camera
```

## Structure

| File | Purpose |
|---|---|
| `App.tsx` | Tabs, native stacks, loading/error states, app lock |
| `store.tsx` | All data, actions (cascading deletes, numbering, timers) and persistence (AsyncStorage) |
| `photoStore.ts` | Photos as files in the app's private documents folder |
| `forms.tsx` | All forms as native page sheets, with validation |
| `DashboardScreen.tsx`, `CustomerScreens.tsx`, `JobScreens.tsx`, `CalendarScreens.tsx`, `SettingsScreens.tsx` | Screens |
| `ui.tsx`, `rows.tsx`, `theme.ts`, `utils.ts`, `types.ts` | Components, colors, helpers, data types |

## Notes

- Data stays on the device (no cloud). App lock with Face ID / device passcode; content is hidden in the app switcher.
- Swipe actions from the SwiftUI version are available via **long press** (native action sheet) on every row.
- In Expo Go, Face ID and camera prompts show "Expo Go" instead of "SHK Pro" – that is normal.
