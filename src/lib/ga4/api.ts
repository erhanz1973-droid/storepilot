/** Google Analytics Data API v1beta client */

type RunReportBody = {
  dateRanges: { startDate: string; endDate: string }[];
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  limit?: string;
  orderBys?: { metric?: { metricName: string }; desc?: boolean }[];
};

type ReportResponse = {
  rows?: {
    dimensionValues?: { value: string }[];
    metricValues?: { value: string }[];
  }[];
  totals?: { metricValues?: { value: string }[] }[];
};

function propertyPath(propertyId: string): string {
  const id = propertyId.replace(/^properties\//, "");
  return `properties/${id}`;
}

export async function runGa4Report(
  accessToken: string,
  propertyId: string,
  body: RunReportBody,
): Promise<ReportResponse> {
  const url = `https://analyticsdata.googleapis.com/v1beta/${propertyPath(propertyId)}:runReport`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GA4 runReport failed (${response.status}): ${text}`);
  }

  return response.json();
}

export function metricTotal(report: ReportResponse, index = 0): number {
  const val = report.totals?.[0]?.metricValues?.[index]?.value;
  return val != null ? Number(val) || 0 : 0;
}

export function sumMetricColumn(report: ReportResponse, index = 0): number {
  if (!report.rows?.length) return metricTotal(report, index);
  return report.rows.reduce((sum, row) => {
    const val = row.metricValues?.[index]?.value;
    return sum + (Number(val) || 0);
  }, 0);
}

export type Ga4AccountSummary = {
  accountId: string;
  accountName: string;
  properties: {
    propertyId: string;
    propertyName: string;
    dataStreams: { streamId: string; streamName: string; measurementId?: string }[];
  }[];
};

export async function listGa4AccountSummaries(accessToken: string): Promise<Ga4AccountSummary[]> {
  const url = "https://analyticsadmin.googleapis.com/v1beta/accountSummaries";
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GA4 accountSummaries failed: ${text}`);
  }

  const data = (await response.json()) as {
    accountSummaries?: {
      account?: string;
      displayName?: string;
      propertySummaries?: {
        property?: string;
        displayName?: string;
      }[];
    }[];
  };

  const out: Ga4AccountSummary[] = [];

  for (const account of data.accountSummaries ?? []) {
    const accountId = account.account?.replace("accounts/", "") ?? "";
    const properties: Ga4AccountSummary["properties"] = [];

    for (const prop of account.propertySummaries ?? []) {
      const propertyId = prop.property?.replace("properties/", "") ?? "";
      let dataStreams: Ga4AccountSummary["properties"][0]["dataStreams"] = [];
      try {
        dataStreams = await listDataStreams(accessToken, propertyId);
      } catch {
        dataStreams = [];
      }
      properties.push({
        propertyId,
        propertyName: prop.displayName ?? propertyId,
        dataStreams,
      });
    }

    out.push({
      accountId,
      accountName: account.displayName ?? accountId,
      properties,
    });
  }

  return out;
}

async function listDataStreams(
  accessToken: string,
  propertyId: string,
): Promise<Ga4AccountSummary["properties"][0]["dataStreams"]> {
  const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    dataStreams?: {
      name?: string;
      displayName?: string;
      webStreamData?: { measurementId?: string };
    }[];
  };

  return (data.dataStreams ?? []).map((s) => ({
    streamId: s.name?.split("/").pop() ?? "",
    streamName: s.displayName ?? "",
    measurementId: s.webStreamData?.measurementId,
  }));
}
