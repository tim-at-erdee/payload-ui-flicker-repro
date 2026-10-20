// Adds each built-in dashboard widget in edit mode and counts what happens in the next 3 seconds.
// Usage: node scripts/repro.mjs [baseUrl]   (dev server must be running, needs Google Chrome)
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const email = "dev@example.com";
const password = "password123";
const widgetNames = ["Welcome", "Collections", "Collection Query", "Recents and pinned", "Upload files"];

await fetch(`${baseUrl}/api/users/first-register`, {
	body: JSON.stringify({ "confirm-password": password, email, password }),
	headers: { "content-type": "application/json", origin: baseUrl },
	method: "POST",
});

const browser = await chromium.launch({ channel: "chrome" });

for (const widgetName of widgetNames) {
	const page = await browser.newPage({ viewport: { height: 900, width: 1400 } });
	await page.goto(`${baseUrl}/admin/login`);
	await page.fill('input[name="email"]', email);
	await page.fill('input[name="password"]', password);
	await page.click('button[type="submit"]');
	await page.waitForURL("**/admin");
	await page.waitForTimeout(3000);

	await page.locator(".step-nav, header").getByText("Dashboard").first().click();
	await page.getByText(/Edit dashboard/i).first().click();
	await page.waitForTimeout(800);
	await page.getByRole("button", { name: /^Add/i }).first().click();
	await page.waitForTimeout(800);

	let serverFunctionCalls = 0;
	page.on("request", (request) => {
		if (request.method() === "POST") {
			serverFunctionCalls++;
		}
	});
	await page.evaluate(() => {
		window.__htmlStyleMutations = 0;
		new MutationObserver((records) => {
			window.__htmlStyleMutations += records.length;
		}).observe(document.documentElement, { attributeFilter: ["style"], attributes: true });
	});

	await page.locator(".drawer").getByText(widgetName).first().click();
	await page.waitForTimeout(3000);

	const htmlStyleMutations = await page.evaluate(() => window.__htmlStyleMutations);
	console.log(`${widgetName}: ${serverFunctionCalls} POSTs, ${htmlStyleMutations} <html> style mutations in 3s`);
	await page.close();
}

await browser.close();
