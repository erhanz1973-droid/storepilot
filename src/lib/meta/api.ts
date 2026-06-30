export type MetaBusiness = {
  id: string;
  name: string;
};

export type MetaAdAccount = {
  id: string;
  name: string;
  accountStatus?: number;
  businessId?: string;
  businessName?: string;
};

export type MetaBusinessWithAccounts = MetaBusiness & {
  adAccounts: MetaAdAccount[];
};

type GraphList<T> = { data?: T[]; paging?: { next?: string } };

async function graphGet<T>(path: string, accessToken: string, params?: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  url.searchParams.set("access_token", accessToken);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta Graph API error: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function listMetaBusinesses(accessToken: string): Promise<MetaBusiness[]> {
  const json = await graphGet<GraphList<{ id: string; name: string }>>(
    "me/businesses",
    accessToken,
    { fields: "id,name", limit: "100" },
  );
  return (json.data ?? []).map((b) => ({ id: b.id, name: b.name }));
}

export async function listOwnedAdAccountsForBusiness(
  accessToken: string,
  businessId: string,
): Promise<MetaAdAccount[]> {
  const json = await graphGet<
    GraphList<{ id: string; name: string; account_status?: number }>
  >(`${businessId}/owned_ad_accounts`, accessToken, {
    fields: "id,name,account_status",
    limit: "100",
  });

  return (json.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    accountStatus: a.account_status,
    businessId,
  }));
}

export async function listPersonalAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const json = await graphGet<
    GraphList<{ id: string; name: string; account_status?: number; business?: { id: string; name: string } }>
  >("me/adaccounts", accessToken, {
    fields: "id,name,account_status,business{id,name}",
    limit: "100",
  });

  return (json.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    accountStatus: a.account_status,
    businessId: a.business?.id,
    businessName: a.business?.name,
  }));
}

export async function listClientAdAccountsForBusiness(
  accessToken: string,
  businessId: string,
): Promise<MetaAdAccount[]> {
  const json = await graphGet<
    GraphList<{ id: string; name: string; account_status?: number }>
  >(`${businessId}/client_ad_accounts`, accessToken, {
    fields: "id,name,account_status",
    limit: "100",
  });

  return (json.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    accountStatus: a.account_status,
    businessId,
  }));
}

function mergeAdAccounts(...groups: MetaAdAccount[][]): MetaAdAccount[] {
  const byId = new Map<string, MetaAdAccount>();
  for (const group of groups) {
    for (const account of group) {
      if (!byId.has(account.id)) byId.set(account.id, account);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listBusinessesWithAdAccounts(
  accessToken: string,
): Promise<MetaBusinessWithAccounts[]> {
  const businesses = await listMetaBusinesses(accessToken);
  const withAccounts: MetaBusinessWithAccounts[] = [];

  for (const business of businesses) {
    const [owned, client] = await Promise.all([
      listOwnedAdAccountsForBusiness(accessToken, business.id),
      listClientAdAccountsForBusiness(accessToken, business.id).catch(() => []),
    ]);
    const adAccounts = mergeAdAccounts(owned, client);
    if (adAccounts.length > 0) {
      withAccounts.push({ ...business, adAccounts });
    }
  }

  const personalAccounts = await listPersonalAdAccounts(accessToken);
  const assignedIds = new Set(
    withAccounts.flatMap((b) => b.adAccounts.map((a) => a.id)),
  );
  const unassigned = personalAccounts.filter((a) => !assignedIds.has(a.id));

  if (unassigned.length > 0) {
    withAccounts.push({
      id: "personal",
      name: "Personal ad accounts",
      adAccounts: unassigned,
    });
  }

  return withAccounts;
}
