# Lv1 Web App Static Deploy

This guide is for the Lv1 BLE manual drive demo from Android Chrome.

## Build

Run from the repository root:

```powershell
npm.cmd install
npm.cmd run build --workspace apps/web
```

The static site output is:

```text
apps/web/dist
```

For Netlify drag-and-drop, Vercel, or Cloudflare Pages with root hosting, the
default Vite base path `/` is suitable.

For GitHub Pages under a repository path, set `VITE_BASE_PATH` before building.
For example, if the site is served from `/Smartphone-driven-rover/`:

```powershell
$env:VITE_BASE_PATH="/Smartphone-driven-rover/"
npm.cmd run build --workspace apps/web
```

## HTTPS Requirement

Web Bluetooth requires a secure context. Use an HTTPS static host for phone
testing. `localhost` is acceptable for development, but HTTP LAN hosting is not
the recommended demo path.

Recommended check device:

- Android Chrome

Not the primary target for this Lv1 check:

- iOS Safari

## Android Chrome Check

1. Open the deployed HTTPS URL in Android Chrome.
2. Select Web Bluetooth in the web app.
3. Press Connect.
4. Choose the matching rover, such as `#01-SDRover`.
5. Confirm heartbeat is running and `heartbeat=ok` appears after telemetry.
6. Confirm the UI shows `Connected device: #01-SDRover`.
7. Check Forward / Back / Left / Right.
8. Check Stop.
9. Check Neutral.
10. Check E-stop.
11. Check Reset E-stop.
12. Disconnect and confirm heartbeat timeout stops the rover.

## Multiple Rover Demo

Use one unique BLE advertising name per Pico W firmware image:

- Rover 1: `#01-SDRover`
- Rover 2: `#02-SDRover`
- Rover 3: `#03-SDRover`

Recommended setup:

1. Put a visible number label on each rover.
2. Flash rover 1 with `#01-SDRover`.
3. Flash rover 2 with `#02-SDRover`.
4. Flash rover 3 with `#03-SDRover`.
5. Phone 1 selects `#01-SDRover`.
6. Phone 2 selects `#02-SDRover`.
7. Phone 3 selects `#03-SDRover`.

The web app filters devices by the rover BLE service UUID, not by a hard-coded
device name. The BLE name is for human selection in the browser chooser.

## Troubleshooting

If the rover does not appear in the BLE chooser:

- Reboot the Pico W.
- Toggle phone Bluetooth off and on.
- Restart Chrome.
- Confirm the web app is opened over HTTPS.
- Confirm there is no nearby rover with the same BLE name.

If an old name appears:

- Reboot the Pico W after flashing.
- Remove stale Bluetooth cache or pairing information on the phone.

If the rover stops right after connection:

- Check heartbeat display in the web UI.
- Check `safety_state` telemetry.
- Confirm E-stop is not latched.

If multiple rovers appear to be mixed up:

- Match the physical rover label with the BLE name.
- Use one phone per rover.
- Do not connect two phones to the same rover during the Lv1 demo.
