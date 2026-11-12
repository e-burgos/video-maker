export const config = {
  slug: 'create-first-invoice',
  baseUrl: process.env.APP_URL ?? 'http://localhost:3000',
  format: 'youtube-16x9',
  startPath: '/',
  apiUrl: process.env.API_URL,
  locale: 'en-US',
  mask: ['[data-private]', '.customer-email'],
  closingSeconds: 4,
};

export const narration = [
  'This is the dashboard, where every invoice of the month lives.',
  'To create a new one, open the invoices menu.',
  'Choose the customer, and the address fills in by itself.',
  'Save it, and the invoice is ready to send.',
];

export async function login(page, { baseUrl, env }) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/email/i).fill(env.DEMO_USER_EMAIL);
  await page.getByLabel(/password/i).fill(env.DEMO_USER_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

export async function onNavigate(page) {
  await page.getByRole('button', { name: /accept|got it|dismiss/i }).first().click({ timeout: 1500 }).catch(() => {});
}

export default async function flow({ page, hito, lineWindow, click, type, goTo, snapshot, apiJson }) {
  hito('dashboard');
  await lineWindow(0);
  await snapshot('dashboard');

  hito('open invoices');
  await click(page.getByRole('link', { name: /invoices/i }).first(), 1200);
  await lineWindow(1);

  hito('pick customer');
  await click(page.getByRole('button', { name: /new invoice/i }), 1000);
  await type(page.getByLabel(/customer/i), 'Northwind');
  await click(page.getByRole('option', { name: /northwind/i }).first(), 800);
  await lineWindow(2);

  hito('save');
  await click(page.getByRole('button', { name: /save/i }), 1500);
  await lineWindow(3);

  const created = apiJson.filter((response) => response.method === 'POST' && response.url.includes('invoices'));
  return { verified: created.length > 0, created: created.map((response) => response.url) };
}
