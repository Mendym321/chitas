# Chitas on your iPhone (test app)

This folder turns the website into a real iPhone app with Capacitor. The app
is a native "shell" that opens https://chitas.vercel.app inside it and adds
what a website can't do: haptics and daily reminders. Every change pushed
live shows up in the app straight away. You only rebuild when this folder
changes (for example, when a new phone feature is added).

The website never uses this folder (`.vercelignore` keeps it off the site).

## One time: get the tools

1. **Node.js.** In Terminal run `node -v`. If it says "command not found",
   install the LTS version from https://nodejs.org and open a new Terminal.
2. **Xcode** from the Mac App Store. Open it once and let it install its
   extra parts.
3. **Your Apple ID in Xcode:** Xcode → Settings → Accounts → + → Apple ID.
   A free Apple ID is enough. It gives you a "Personal Team".
4. **Developer Mode on the iPhone:** Settings → Privacy & Security →
   Developer Mode → on. The phone restarts. (The option appears after the
   iPhone has been plugged into a Mac with Xcode once.)

## Build and put it on the phone

In Terminal:

```
git clone https://github.com/Mendym321/chitas.git
cd chitas/app
npm install
npx cap add ios
npm run ios
```

`npx cap add ios` makes the Xcode project (the `ios` folder); you do that
only once. `npm run ios` copies the settings in and opens Xcode.

In Xcode:

1. In the left column click **App** (the blue icon at the top).
2. Open the **Signing & Capabilities** tab. Tick "Automatically manage
   signing" and pick your **Team** (Your Name, Personal Team).
3. If it says the Bundle Identifier is taken, change `app.chitas.daily` to
   something only you would use, like `app.chitas.daily.yourname`.
4. Plug in the iPhone and pick it at the top of the window (next to the ▶).
5. Press **▶** (Run).

The first time, the phone will refuse to open it. On the iPhone go to
Settings → General → VPN & Device Management → your Apple ID → Trust.
Then open Chitas.

With a free Apple ID the app stops opening after 7 days: plug in and press
▶ again. A paid developer account ($99 a year) lifts that and adds
TestFlight.

## What to try

- Profile → **On this phone**: turn on the daily reminder (the phone asks
  for permission), pick a time a couple of minutes from now, close the app
  and wait for it.
- Mark a section learned: a light tap. Finish all four: the "success" buzz.

## Not working yet in the app

- **Signing in.** Google and Apple don't allow their sign-in pages inside
  an app; that needs a native sign-in plugin (the next step before the App
  Store). Use the app without signing in for now: progress is kept on the
  phone.

## When this folder changes

```
cd chitas
git pull
cd app
npm install
npm run ios
```

Then press ▶ in Xcode again.
