#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadCredentials } from "./credentials.js";

const creds = loadCredentials();
if (!creds) {
  process.stderr.write(
    "Error: no Porkbun credentials found.\n" +
    "Run: npm run setup\n"
  );
  process.exit(1);
}

const AUTH = { apikey: creds.apiKey, secretapikey: creds.secretKey };

// --- Porkbun API client ---

const BASE_URL = "https://api.porkbun.com/api/json/v3";

async function pbPost(path, body = {}) {
  const url = `${BASE_URL}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...AUTH, ...body }),
    });
  } catch (err) {
    throw new Error(`Network error reaching Porkbun API: ${err.message}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Porkbun API returned non-JSON response (HTTP ${res.status})`);
  }

  if (data.status === "ERROR") {
    throw new Error(`Porkbun API error: ${data.message ?? "unknown error"}`);
  }

  return data;
}

// --- Validation helpers ---

const VALID_RECORD_TYPES = new Set([
  "A", "AAAA", "MX", "CNAME", "TXT", "NS", "SRV", "CAA", "ALIAS", "TLSA",
]);

const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const ID_RE = /^\d+$/;

function validateDomain(domain) {
  if (!DOMAIN_RE.test(domain)) {
    throw new Error(`Invalid domain name: "${domain}"`);
  }
}

function validateRecordType(type) {
  if (!VALID_RECORD_TYPES.has(type.toUpperCase())) {
    throw new Error(
      `Invalid record type "${type}". Must be one of: ${[...VALID_RECORD_TYPES].join(", ")}`
    );
  }
  return type.toUpperCase();
}

function validateId(id) {
  if (!ID_RE.test(String(id))) {
    throw new Error(`Invalid record ID "${id}". Must be a numeric value.`);
  }
}

// --- Output formatters ---

function formatDomain(d) {
  const expiry = d.expireDate ? ` (expires ${d.expireDate})` : "";
  return `${d.domain}${expiry}`;
}

function formatRecord(r) {
  const name = r.name || "@";
  const prio = r.prio && r.prio !== "0" ? ` priority=${r.prio}` : "";
  return `[${r.type}] ${name} → ${r.content} (TTL ${r.ttl}, ID ${r.id}${prio})`;
}

// --- MCP server setup ---

const server = new McpServer({
  name: "porkbun-dns",
  version: "1.0.0",
});

server.tool(
  "list_domains",
  "List all domains registered on the Porkbun account, with expiry dates where available.",
  {},
  async () => {
    try {
      const data = await pbPost("/domain/listAll");
      const domains = data.domains ?? [];
      if (domains.length === 0) {
        return { content: [{ type: "text", text: "No domains found on this account." }] };
      }
      const lines = domains.map(formatDomain).join("\n");
      return { content: [{ type: "text", text: lines }] };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

server.tool(
  "list_dns_records",
  "List all DNS records for a domain. Returns record type, name, value, TTL, and record ID.",
  { domain: z.string().describe("The domain name to retrieve DNS records for, e.g. example.com") },
  async ({ domain }) => {
    try {
      validateDomain(domain);
      const data = await pbPost(`/dns/retrieve/${domain}`);
      const records = data.records ?? [];
      if (records.length === 0) {
        return { content: [{ type: "text", text: `No DNS records found for ${domain}.` }] };
      }
      const lines = records.map(formatRecord).join("\n");
      return { content: [{ type: "text", text: lines }] };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

server.tool(
  "create_dns_record",
  "Create a new DNS record for a domain. Returns the new record's ID on success.",
  {
    domain: z.string().describe("The domain to add the record to, e.g. example.com"),
    type: z
      .string()
      .describe(
        "DNS record type. One of: A, AAAA, MX, CNAME, TXT, NS, SRV, CAA, ALIAS, TLSA"
      ),
    name: z
      .string()
      .describe(
        'Subdomain or record name. Use an empty string or "@" for the root domain. For a subdomain use just the prefix, e.g. "www" not "www.example.com"'
      ),
    content: z.string().describe("The record value, e.g. an IP address for A records or target hostname for CNAME"),
    ttl: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Time-to-live in seconds. Minimum 600. Defaults to 300 if omitted."),
    prio: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Priority for MX and SRV records. Ignored for other types."),
  },
  async ({ domain, type, name, content, ttl, prio }) => {
    try {
      validateDomain(domain);
      const normalizedType = validateRecordType(type);
      const body = { type: normalizedType, name: name ?? "", content };
      if (ttl !== undefined) body.ttl = String(ttl);
      if (prio !== undefined) body.prio = String(prio);
      const data = await pbPost(`/dns/create/${domain}`, body);
      return {
        content: [
          {
            type: "text",
            text: `DNS record created successfully.\nID: ${data.id}\n[${normalizedType}] ${name || "@"}.${domain} → ${content}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

server.tool(
  "edit_dns_record",
  "Edit an existing DNS record by its numeric ID. Use list_dns_records to find record IDs.",
  {
    domain: z.string().describe("The domain the record belongs to, e.g. example.com"),
    id: z.string().describe("The numeric ID of the DNS record to edit (from list_dns_records)"),
    type: z
      .string()
      .describe(
        "New DNS record type. One of: A, AAAA, MX, CNAME, TXT, NS, SRV, CAA, ALIAS, TLSA"
      ),
    content: z.string().describe("New record value"),
    ttl: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("New TTL in seconds. Minimum 600."),
    prio: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("New priority for MX and SRV records."),
  },
  async ({ domain, id, type, content, ttl, prio }) => {
    try {
      validateDomain(domain);
      validateId(id);
      const normalizedType = validateRecordType(type);
      const body = { type: normalizedType, content };
      if (ttl !== undefined) body.ttl = String(ttl);
      if (prio !== undefined) body.prio = String(prio);
      await pbPost(`/dns/edit/${domain}/${id}`, body);
      return {
        content: [
          {
            type: "text",
            text: `DNS record ${id} updated successfully.\n[${normalizedType}] ${domain} → ${content}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

server.tool(
  "delete_dns_record",
  "Permanently delete a DNS record by its numeric ID. This action cannot be undone. Use list_dns_records to find record IDs before deleting.",
  {
    domain: z.string().describe("The domain the record belongs to, e.g. example.com"),
    id: z.string().describe("The numeric ID of the DNS record to delete (from list_dns_records)"),
  },
  async ({ domain, id }) => {
    try {
      validateDomain(domain);
      validateId(id);
      await pbPost(`/dns/delete/${domain}/${id}`);
      return {
        content: [
          {
            type: "text",
            text: `DNS record ${id} for ${domain} has been permanently deleted.`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

// --- Start server ---

const transport = new StdioServerTransport();
await server.connect(transport);
