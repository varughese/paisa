/**
 * Client-side Lunch Money API calls. All requests run in the browser;
 * no Next.js API routes are used.
 */

const LUNCH_MONEY_BASE = "https://dev.lunchmoney.app/v1";

export interface LunchMoneyUser {
  user_name: string;
  budget_name: string;
  primary_currency: string;
}

export interface LunchMoneyTransaction {
  id: number;
  date: string;
  amount: string;
  currency: string;
  to_base: number;
  payee: string;
  category_name: string | null;
  category_group_name: string | null;
  is_income: boolean;
  exclude_from_totals: boolean;
}

async function request<T>(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<T> {
  const url = path.startsWith("http") ? path : `${LUNCH_MONEY_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Lunch Money API error: ${res.status}`);
  }

  return res.json();
}

export async function fetchUser(apiKey: string): Promise<LunchMoneyUser> {
  return request<LunchMoneyUser>("/me", apiKey);
}

export async function fetchTransactions(
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<LunchMoneyTransaction[]> {
  const limit = 500;
  let offset = 0;
  const all: LunchMoneyTransaction[] = [];

  while (true) {
    const path = `/transactions?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&debit_as_negative=true&limit=${limit}&offset=${offset}`;
    const data = await request<{ transactions: LunchMoneyTransaction[] }>(
      path,
      apiKey
    );
    const transactions = data.transactions || [];
    all.push(...transactions);
    if (transactions.length < limit) break;
    offset += limit;
  }

  return all;
}
