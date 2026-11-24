# NFR-05 manual screen-reader check

Use the [isolated demo](../../development/demo-catalog.md), one Player and one Owner account. On macOS use VoiceOver with Safari; on Windows use NVDA with Firefox or Chrome. Record OS, browser, screen reader and versions, viewport, build SHA, spoken result, and Pass/Fail for each task. Use test credentials and mask sensitive content in any recording.

| Task | Expected announcement and action |
|---|---|
| Browse at 375 px | The first Tab reaches Skip to content. Main, navigation, headings, search fields and Find courts have meaningful names. Open and close the mobile menu and verify focus returns to its trigger. |
| Search and recover | Find an existing demo venue. Clear the filters and search with no matches. Confirm the result state and retry are discoverable. After an invalid datetime range, confirm the field’s label and error are announced together. |
| Slot list and review | Open the court and tab to available slots. Available, booked and blocked are spoken as text. Select two adjacent slots. Confirm the review dialog announces its title and price. Use Escape and confirm the focus returns to the review button. |
| Booking and Open Play | Confirm a future booking and verify status and total on reload. Open an eligible Room and check capacity, places and Join/Leave buttons. Use a confirmation dialog and exercise Keep and Confirm. |
| Owner schedule | In Lịch sân select a court and date. Open the batch editor, change a field, press Escape and choose Keep. Check that values and usable focus return. Open a blocked or maintenance row and confirm the state is understandable. |
| Wide layout | Repeat search, review and Owner navigation at 768 and 1280 CSS px. Record any clipped control, skipped meaningful content, repeated live announcement or loss of focus. |

Axe, Lighthouse and keyboard-only runs provide automated evidence. Record observed speech from the manual run before closing TC-20 and NFR-05.
