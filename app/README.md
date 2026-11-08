# Chitas on your phone (iPhone and Android)

This folder turns the website into real phone apps with Capacitor. Each app
is a native "shell" that opens https://chitas.vercel.app inside it and adds
what a website can't do: haptics, daily reminders, and the phone's own
sign-in (Apple and Google). Every change pushed live shows up in the apps
straight away. You only rebuild when this folder changes.

The website never uses this folder (`.vercelignore` keeps it off the site).

**Why the phone's own sign-in?** Google doesn't allow its sign-in page
inside an app's web view, and Apple's App Store requires "Sign in with Apple"
next to Google. So in the app, the phone signs you in (the plugin
`@capacitor-firebase/authentication`), hands the website a token, and the
website signs in to Firebase with it. In a browser, sign-in is the same
pop-up as before. The code is in `index.html` (search for `nativeAuth`) and
it's tested in `tools/test-native-signin.mjs`.

---

## Part 1: Firebase (one time, in the browser)

Open https://console.firebase.google.com → the **chitas-daily** project.

1. **Turn on Apple:** Build → Authentication → Sign-in method → Add new
   provider → **Apple** → Enable → Save. (For the iPhone app nothing else is
   needed on this page.)
2. **Add the iPhone app:** Project settings (the gear) → Your apps → Add app
   → **iOS**. Bundle ID: `app.chitas.daily`. Register, then **download
   `GoogleService-Info.plist`**. Keep it for Part 2.
3. **Add the Android app:** Add app → **Android**. Package name:
   `app.chitas.daily`. Register, then **download `google-services.json`**.
   Keep it for Part 3. (You'll come back here for the "SHA-1" in Part 3.)

These two files only say which Firebase project the app belongs to. They're
not secret, but there's no need to put them on GitHub: Part 2 and 3 say
where they go on your computer.

---

## Part 2: iPhone (on your Mac)

### One time: the tools

1. **Node.js.** In Terminal run `node -v`. If it says "command not found",
   install the LTS version from https://nodejs.org and open a new Terminal.
2. **Xcode** from the Mac App Store. Open it once and let it install its
   extra parts.
3. **Apple Developer Program** ($99 a year, https://developer.apple.com/programs/).
   Sign in with Apple only works with a paid account (a free "Personal
   Team" can't add it). It's also what the App Store needs.
4. **Your Apple ID in Xcode:** Xcode → Settings → Accounts → + → Apple ID.
5. **Developer Mode on the iPhone:** Settings → Privacy & Security →
   Developer Mode → on. (It appears after the iPhone has been plugged into
   the Mac with Xcode open once.)

### Make the Xcode project

In Terminal:

```
git clone https://github.com/Mendym321/chitas.git
cd chitas/app
npm install
npx cap add ios
```

`npx cap add ios` makes the Xcode project (the `ios` folder). You do this
only once.

Now put the Firebase file in: copy `GoogleService-Info.plist` (from Part 1)
into `chitas/app/ios/App/App/`. **This must be done before the first build:
without it the app closes as soon as it opens.**

Then:

```
npm run ios
```

That copies the settings in and opens Xcode.

### In Xcode (one time)

1. In the left column click **App** (the blue icon at the top), then the
   **App** target.
2. **Add the Firebase file to the project:** drag `GoogleService-Info.plist`
   from Finder (`ios/App/App/`) onto the yellow **App** folder in Xcode's left
   column. Tick "Copy items if needed" off, and the **App** target on. Finish.
3. **Signing & Capabilities** tab: tick "Automatically manage signing" and
   pick your **Team** (your paid developer account).
4. Still there: **+ Capability** → **Sign in with Apple**.
5. **Info** tab → **URL Types** → **+**. In **URL Schemes** paste the value of
   `REVERSED_CLIENT_ID` from `GoogleService-Info.plist` (open it in Xcode; it
   starts with `com.googleusercontent.apps.`). This lets Google's sign-in
   come back to the app.
6. Plug in the iPhone, pick it at the top of the window (next to ▶), and
   press **▶**.

The first time, the phone may refuse to open it: Settings → General → VPN &
Device Management → your Apple ID → Trust. Then open Chitas.

### Try it

- **Sign in with Apple** and **Continue with Google** on the sign-in sheet.
  The phone's own sign-in should slide up, then the app opens on your
  account.
- Profile → **On this phone**: turn on a reminder, set it a couple of
  minutes ahead, close the app and wait.
- Mark a section learned: a light tap. Finish all four: the "success" buzz.
- Deleting an account that uses Apple asks Apple once more (Apple wants apps
  to cancel the sign-in too); then everything is deleted.

---

## Part 3: Android (any computer: Mac, Windows or Linux)

The Android project is already in this folder (`app/android`), with the
icon, the splash screen and the sign-in settings done.

### One time: the tools

1. **Node.js** (as above).
2. **Android Studio** from https://developer.android.com/studio. Open it once
   and let it download what it offers (the "SDK").
3. To try it on a phone: an **Android phone** with Developer options on
   (Settings → About phone → tap "Build number" 7 times; then Developer
   options → USB debugging → on). Or skip this and use Android Studio's
   built-in phone ("emulator").
4. To publish: a **Google Play developer account** ($25 once,
   https://play.google.com/console).

### Build and run

```
git clone https://github.com/Mendym321/chitas.git   (or: git pull)
cd chitas/app
npm install
```

Copy `google-services.json` (from Part 1) into `chitas/app/android/app/`.
**Again: before the first build.**

```
npm run android
```

This opens Android Studio. Wait for it to finish "Gradle sync" (bottom bar),
pick your phone or the emulator at the top, and press **▶**.

### The SHA-1 (so Google sign-in works on Android)

Google checks that sign-in comes from *your* app, by its signing key's
fingerprint (the "SHA-1").

1. In Android Studio's **Terminal** tab (bottom), inside `app/android`, run:
   `./gradlew signingReport` (on Windows: `gradlew signingReport`).
2. Copy the line `SHA1: ...` under `Variant: debug`.
3. Firebase → Project settings → Your apps → the Android app → **Add
   fingerprint** → paste → Save.
4. Download `google-services.json` again and replace the old one.

When you publish on Google Play, Play signs the app with its own key: add
that SHA-1 too (Play Console → your app → Test and release → App integrity →
App signing), and download `google-services.json` once more.

Android shows only Google sign-in (Apple's is for iPhones).

---

## When this folder changes

```
cd chitas
git pull
cd app
npm install
npm run ios        (or: npm run android)
```

Then press ▶ again.
