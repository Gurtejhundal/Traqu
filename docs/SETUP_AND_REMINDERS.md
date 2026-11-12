# Make yourself at home · 1.8.0

Native desktop and Android open with a short, skippable setup: name and optional photo, interest chips and a one-tap goal, then optional reminders. Nothing requires a long form or an account. Photos use the existing validated, resized image flow; Personalize offers detailed cropping afterward. Returning workspaces receive setup once without changing their roadmaps. Set up later keeps existing profile choices.

Profile now has Overview, Personalize, Preferences and **AI connections**. AI connections separates live workspace access, reusable agent workflows and manual browser-chat prompts. Plugin/skill installation does not enable MCP or editing. See [the client guide](MCP.md).

The navigation bell holds a dismissible AI setup suggestion and an opted-in daily reminder. Dismissals persist with the profile and its backups. There are no repeated connection popups or storage banners. Change interests under **Profile → Personalize**, and reminder time or notification choices under **Profile → Preferences**. Settings have explicit Save/Discard controls.

Desktop notifications are off by default. Enable Daily reminder and Also send a desktop notification, then save. Traqu checks its saved preferences every 30 seconds while running, including minimized. The notification uses the profile timezone or the system timezone, is silent, and clicks through to the library. Delivery is attempted once per local day, within 15 minutes after the selected time. Closing the app stops reminders. System notification permissions, Do Not Disturb and desktop support determine actual display. Delivery deduplication records attempts, not proof that a human saw the notification. macOS requires a signed build for native delivery; the existing unsigned release must use the in-app reminder. Windows uses the installed Start Menu identity. See [Electron’s platform requirements](https://www.electronjs.org/docs/latest/tutorial/notifications#platform-considerations).

On Android, daily reminders appear in the in-app inbox after the chosen time. This release does not schedule native background notifications. Turning reminders off removes the daily inbox item and stops future desktop attempts. The optional AI suggestion can be dismissed separately.

Restore remains additive: meaningful existing profile choices are preserved. A blank profile created only by skipping setup or dismissing a suggestion does not prevent recovery of a real saved profile. Plans, completion history and notes keep their existing recovery rules.

Checks cover setup completion and skipping, profile persistence, photo selection, client workflow choices, mobile layout overflow, reminder consent/timezones/deduplication, invalid preferences, and recovery. Native notification appearance and third-party agent UIs require platform/device verification.
