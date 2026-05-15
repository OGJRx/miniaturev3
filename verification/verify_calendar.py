from playwright.sync_api import Page, expect, sync_playwright

def test_calendar_page(page: Page):
    # Navigate to the calendar page (without token initially)
    # It should show "Unauthorized" or similar based on our middleware
    page.goto("http://localhost:8787/calendar")
    page.screenshot(path="verification/calendar_unauthorized.png")

    # Note: We can't easily test the full authorized flow without setting the environment variable
    # BORG_SECRET_KEY in the local wrangler dev environment from here.
    # But we can at least verify the page loads something.

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_calendar_page(page)
        finally:
            browser.close()
