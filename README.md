# Website Time Limiter Chrome Extension

A Chrome extension to help you manage your time on specific websites by setting daily usage limits. Once the time limit is reached, the website is blocked until the next day or until you extend the time.

---

## Features

- **Set Daily Time Limits:** Add websites and set daily time limits (in hours, minutes, and seconds) via a user-friendly popup.
- **Real-Time Tracking:** Tracks time spent on specified websites across all open tabs (background script tracks usage).
- **Automatic Blocking:** Redirects to a "blocked" page when the time limit is reached for a website.
- **Time Extension:** Option to extend time from the blocked page (via a message to the background script).
- **Daily Reset:** Automatically resets time limits at the start of each day.
- **Professional UI:** Clean and modern popup design with a card-based layout for managing websites.

---

## Installation

### From GitHub

1. **Clone or Download the Repository:**
    ```
    git clone https://github.com/your-username/website-time-limiter.git
    ```
    Or download the ZIP file and extract it.

2. **Load the Extension in Chrome:**
    - Open Chrome and go to `chrome://extensions/`.
    - Enable "Developer mode" (toggle in the top-right corner).
    - Click "Load unpacked" and select the folder containing the extension files (`website-time-limiter`).

3. **Verify Installation:**
    - The extension icon should appear in the Chrome toolbar.
    - Pin the extension for easy access by clicking the puzzle icon in the toolbar, finding "Website Time Limiter," and clicking the pin icon.

---

### From Chrome Web Store (Optional)

*(If you publish the extension on the Chrome Web Store, add instructions here.)*

---

## Usage

- **Open the Popup:**
    - Click the extension icon in the Chrome toolbar to open the popup.

- **Add a Website:**
    - Enter the website URL (e.g., `facebook.com`) in the "Website" input field.
    - Set the daily time limit using the "Hours," "Minutes," and "Seconds" fields.
    - Click the "Add" button to save the limit.
    - The website will appear in the list below with its daily quota and remaining time.

- **Monitor Time Usage:**
    - Open any tab to a tracked website (e.g., `https://facebook.com`).
    - The extension tracks the time spent on the website across all tabs.
    - The "Time Left" in the popup updates as you use the website (if the popup is open).

- **Blocked Page:**
    - When the time limit is reached, the website tab redirects to a "blocked" page (`blocked.html`).
    - From the blocked page, you can extend the time (if implemented) by sending a message to the background script.

- **Remove a Website:**
    - In the popup, click the "Remove" button next to a website to delete its time limit.

---

## Files Overview

| File            | Purpose                                                                                  |
|-----------------|------------------------------------------------------------------------------------------|
| `content.js`    | Handles the popup UI logic, including adding/removing websites, displaying the list, and listening for storage changes to update the UI. |
| `background.js` | Runs in the background to track time usage across all open tabs, decrement time limits, reset limits daily, and block websites when limits are reached. |
| `blocked.html`  | The page displayed when a website's time limit is reached (you’ll need to create this file if not already present). |
| `manifest.json` | The extension manifest file (ensure it includes the necessary permissions and scripts).   |

---

## Example `manifest.json`


---

## Development

### Prerequisites

- Google Chrome browser
- Basic knowledge of Chrome extension development

### Setup

- Clone the repository (as described in the Installation section).
- Ensure all files (`content.js`, `background.js`, `popup.html`, etc.) are in the project directory.
- Create or add an icon for the extension (`icon48.png`, `icon128.png`) and update the `manifest.json` accordingly.
- Load the extension in Chrome (as described in the Installation section).

### Debugging

- **Popup Logs:** Right-click the extension icon, select "Inspect popup," and check the console for logs.
- **Background Logs:** Go to `chrome://extensions/`, find the extension, and click "service worker" to view background script logs.
- **Storage Data:** Use `chrome.storage.local.get('websiteLimits', console.log)` in the DevTools console to inspect stored data.

---

## Known Issues

When the daily quota is over the block page opens, by replacing the current page. Because of that when you try to ignore time for 1 min, 15 mins the pages refrshes, which is a bad experience.

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch:
    ```
    git checkout -b feature/your-feature
    ```
3. Make your changes and commit them:
    ```
    git commit -m "Add your feature"
    ```
4. Push to the branch:
    ```
    git push origin feature/your-feature
    ```
5. Open a Pull Request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Contact

For questions or feedback, please open an issue on GitHub or contact [kumarsaurav.15@gmail.com](mailto:your-kumarsaurav.15@gmail.com).
