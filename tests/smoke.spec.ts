import { expect, test } from '@playwright/test';

test('shows loading, then allows submit and renders overview plus results marker', async ({
  page,
}) => {
  await page.goto('/?testMode=mock-ready');

  await expect(page.getByText('Model ready.')).toBeVisible();
  await expect(page.getByTestId('model-mode-toggle')).toBeVisible();
  await page.getByTestId('model-mode-toggle').click();
  await expect(
    page.getByText('DeepSeek-R1-Distill-Qwen-1.5B (Advanced mode) is loaded locally in your browser.'),
  ).toBeVisible();

  const input = page.getByLabel('Search query');
  await input.fill('What is the speed of light?');

  await page.getByRole('button', { name: 'Google Search' }).click();
  await expect(page.getByTestId('pse-loading-skeleton')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'AI Overview', exact: true })).toBeVisible();
  await expect(page.getByTestId('model-mode-toggle')).toHaveCount(0);
  await expect(page.getByText(/local mock response/i)).toBeVisible();
  await expect(
    page.getByText(
      /Generated locally by DeepSeek-R1-Distill-Qwen-1.5B \(Advanced mode\) from the query only/,
    ),
  ).toBeVisible();
  await expect(page.getByText('Showing results for “What is the speed of light?”.')).toBeVisible();

  await page.getByRole('button', { name: 'Trust Me Bro home' }).click();
  await expect(page.getByLabel('Search query')).toHaveValue('What is the speed of light?');
  await expect(page.getByTestId('model-mode-toggle')).toBeVisible();
});

test('shows generation error with retry control in forced failure mode', async ({ page }) => {
  await page.goto('/?testMode=mock-generation-error');

  await expect(page.getByText('Model ready.')).toBeVisible();

  await page.getByLabel('Search query').fill('Why is the sky blue?');
  await page.getByRole('button', { name: 'Google Search' }).click();

  await expect(page.getByText('Could not generate overview.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('keeps latest query content after rapid resubmission', async ({ page }) => {
  await page.goto('/?testMode=mock-ready');

  await expect(page.getByText('Model ready.')).toBeVisible();

  const input = page.getByLabel('Search query');
  await input.fill('react');
  await page.getByRole('button', { name: 'Google Search' }).click();

  await page.getByLabel('Search query').fill('vue');
  await page.keyboard.press('Enter');

  await expect(page.getByText('Showing results for “vue”.')).toBeVisible();
  await expect(page.getByText('Showing results for “react”.')).toHaveCount(0);
  await expect(page.getByText(/local mock response for vue/i)).toBeVisible();
  await expect(page.getByText(/local mock response for react/i)).toHaveCount(0);
});
