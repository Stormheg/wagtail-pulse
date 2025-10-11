import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";
import { render } from "https://deno.land/x/eta@v2.0.0/mod.ts";

function justNumber(node: any): number | null {
  const match = node
    .text()
    .trim()
    .match(/[0-9]+/);
  if (match) {
    return parseInt(match[0]);
  } else {
    console.error("Failed to extract number from:", node.html());
    return null;
  }
}

type OverviewStatistics = {
  new_issues_last_month: number | null;
  closed_issues_last_month: number | null;
  opened_pull_requests_last_month: number | null;
  merged_pull_requests_last_month: number | null;
  contributors_last_month: number | null;
  total_contributors: number | null;
  total_pull_requests: number | null;
  total_issues: number | null;
  total_starcount: number | null;
  range_label: string | null;
};

async function retrieveOverviewData() {
  const headers = {
    "X-Requested-With": "XMLHttpRequest", // Important, otherwise GitHub returns a 400
  };
  const monthlyOverviewStatisticsResponse = fetch(
    "https://github.com/wagtail/wagtail/pulse-new/pulse-overview-data/monthly",
    { headers }
  );
  const monthlyDiffStatisticsResponse = fetch(
    "https://github.com/wagtail/wagtail/pulse-new/pulse-diffstat-summary/monthly",
    { headers }
  );
  const apiResponse = fetch("https://api.github.com/repos/wagtail/wagtail");
  const repoResponse = fetch("https://github.com/wagtail/wagtail");

  const [monthlyOverviewResp, monthlyDiffResp, apiResp, repoResp] =
    await Promise.all([
      monthlyOverviewStatisticsResponse,
      monthlyDiffStatisticsResponse,
      apiResponse,
      repoResponse,
    ]);

  const aggregatedData: OverviewStatistics = {
    new_issues_last_month: null,
    closed_issues_last_month: null,
    opened_pull_requests_last_month: null,
    merged_pull_requests_last_month: null,
    contributors_last_month: null,
    total_pull_requests: null,
    total_issues: null,
    total_starcount: null,
    total_contributors: null,
    range_label: null,
  };

  if (monthlyOverviewResp.ok) {
    const monthlyOverviewJSON = await monthlyOverviewResp.json();
    aggregatedData.range_label = monthlyOverviewJSON.rangeLabel;
    aggregatedData.new_issues_last_month = monthlyOverviewJSON.newIssues.length;
    aggregatedData.closed_issues_last_month =
      monthlyOverviewJSON.closedIssues.length;
    aggregatedData.opened_pull_requests_last_month =
      monthlyOverviewJSON.newPulls.length;
    aggregatedData.merged_pull_requests_last_month =
      monthlyOverviewJSON.mergedPulls.length;
  }
  if (monthlyDiffResp.ok) {
    const monthlyDiffJSON = await monthlyDiffResp.json();
    aggregatedData.contributors_last_month = monthlyDiffJSON.authorsWithCommits;
  }
  if (apiResp.ok) {
    const apiJSON = await apiResp.json();
    aggregatedData.total_starcount = apiJSON["stargazers_count"];
  }
  if (repoResp.ok) {
    const repoHTML = await repoResp.text();
    const $ = cheerio.load(repoHTML);
    aggregatedData.total_pull_requests = justNumber(
      $("span[data-content='Pull requests']").next()
    );
    aggregatedData.total_issues = justNumber(
      $("span[data-content='Issues']").next()
    );
    aggregatedData.total_contributors = justNumber(
      $("a[href$='/graphs/contributors'] .Counter").first()
    );
  }

  return aggregatedData;
}

async function handleResponseHTML(overviewStats: OverviewStatistics) {
  const template = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wagtail Statistics - <%= it.range_label ?? '(unknown)' %></title>
    <style>
    body {
      font-family: system-ui, sans-serif;
      background: #f8f9fa;
      color: #222;
      margin: 0;
      padding: 2rem;
    }
    h1 {
      color: #2c3e50;
      margin-bottom: 0.5em;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      max-width: 600px;
      margin: 1.5em 0;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    th, td {
      padding: 0.75em 1em;
      border-bottom: 1px solid #e1e4e8;
      text-align: left;
    }
    th {
      background: #f3f6fa;
      font-weight: 500;
      width: 60%;
    }
    td {
      width: 40%;
    }
    tr:last-child td, tr:last-child th {
      border-bottom: none;
    }
    button {
      background: #0074d9;
      color: #fff;
      border: none;
      padding: 0.5em 1.2em;
      border-radius: 4px;
      font-size: 1em;
      cursor: pointer;
      margin-bottom: 1em;
      transition: background 0.2s, box-shadow 0.2s;
      outline: none;
    }
    button:hover,
    button:focus {
      background: #005fa3;
      box-shadow: 0 0 0 3px #80bfff;
    }
    a {
      color: #0074d9;
      text-decoration: none;
      outline: none;
      transition: color 0.2s, box-shadow 0.2s;
    }
    a:hover,
    a:focus {
      color: #005fa3;
      text-decoration: underline;
      box-shadow: 0 0 0 3px #80bfff;
    }
    @media (max-width: 700px) {
      body {
        padding: 1em;
      }
      table {
        font-size: 0.95em;
      }
    }
  </style>
  <script>
    function copyTSV() {
      const rows = Array.from(document.querySelectorAll('table tr'));
      // Only select the value cells (td), skip headers (th)
      const tsv = rows.map(row => {
        const td = row.querySelector('td');
        // If the cell contains '(failed to retrieve)', use empty string
        if (td && td.textContent.includes('(failed to retrieve)')) {
          return '';
        }
        return td ? td.textContent.trim() : '';
      }).filter(line => line !== null).join('\\n');
      navigator.clipboard.writeText(tsv);
      alert('Table values copied as TSV!');
    }
  </script>
</head>
<body>
  <h1>Wagtail Pulse Overview</h1>
  <p>This page provides an overview of Wagtail's GitHub activity for the period: <strong><%= it.range_label ?? '(unknown, failed to retrieve)'%></strong>. It is sourced from scraping GitHub.</p>
  <button onclick="copyTSV()">Copy values as TSV</button>
  <small>(for easy pasting into spreadsheets)</small>
  <table>
    <tr><th>New Issues Last Month</th><td><%= it.new_issues_last_month ?? '(failed to retrieve)' %></td></tr>
    <tr><th>Closed Issues Last Month</th><td><%= it.closed_issues_last_month ?? '(failed to retrieve)' %></td></tr>
    <tr><th>Opened Pull Requests Last Month</th><td><%= it.opened_pull_requests_last_month ?? '(failed to retrieve)' %></td></tr>
    <tr><th>Merged Pull Requests Last Month</th><td><%= it.merged_pull_requests_last_month ?? '(failed to retrieve)' %></td></tr>
    <tr><th>Contributors Last Month</th><td><%= it.contributors_last_month ?? '(failed to retrieve)' %></td></tr>
    <tr><th>Total Pull Requests</th><td><%= it.total_pull_requests ?? '(failed to retrieve)' %></td></tr>
    <tr><th>Total Issues</th><td><%= it.total_issues ?? '(failed to retrieve)' %></td></tr>
    <tr><th>Total Star Count</th><td><%= it.total_starcount ?? '(failed to retrieve)' %></td></tr>
    <tr><th>Total Contributors</th><td><%= it.total_contributors ?? '(failed to retrieve)' %></td></tr>
  </table>
  <p><a href="?format=json">View as JSON</a></p>
</body>
</html>
`;
  return (await render(template, overviewStats)) as string;
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const acceptHeader = req.headers.get("Accept") || "";

  const overviewStats = await retrieveOverviewData();

  // If the request has a json query parameter, return JSON
  if (url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify(overviewStats), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  // If the Accept header prefers HTML, return HTML
  if (acceptHeader.includes("text/html")) {
    const htmlContent = await handleResponseHTML(overviewStats);
    return new Response(htmlContent, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Default to returning JSON
  return new Response(JSON.stringify(overviewStats), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

serve(handler);
