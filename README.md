# Porkbun DNS MCP Server

A local [Model Context Protocol](https://modelcontextprotocol.io) server for managing Porkbun DNS through any MCP-compatible AI client. Runs as a local stdio process and is never exposed to the network.

## Requirements

- Node.js 18+
- A Porkbun account with API access enabled
- Your Porkbun API key and secret key ([grab them here](https://porkbun.com/account/api))

## Setup

```sh
git clone https://github.com/flntfnd/porkbun-mcp.git
cd porkbun-mcp
npm install
npm run setup
```

The setup script will:
1. Prompt for your Porkbun API key and secret key (input is masked)
2. Store them securely (macOS Keychain, or a permissions-restricted file on Linux/Windows)
3. Register the MCP server in `~/.claude.json`

Restart Claude Code and run `/mcp` to confirm the server is listed.

### Manual setup

Add this to `~/.claude.json` under `mcpServers`:

```json
"porkbun-dns": {
  "command": "node",
  "args": ["/absolute/path/to/porkbun-mcp/index.js"]
}
```

Then either run `npm run setup` to store credentials, or set environment variables:

```sh
export PORKBUN_API_KEY="pk1_..."
export PORKBUN_SECRET_KEY="sk1_..."
```

## Available tools

| Tool | Description |
|---|---|
| `list_domains` | List all domains on the account with expiry dates |
| `list_dns_records` | List all DNS records for a domain |
| `create_dns_record` | Create a new DNS record |
| `edit_dns_record` | Edit an existing record by ID |
| `delete_dns_record` | Delete a record by ID |

Supported record types: `A`, `AAAA`, `MX`, `CNAME`, `TXT`, `NS`, `SRV`, `CAA`, `ALIAS`, `TLSA`

## Security

- On macOS, credentials are stored in the system Keychain
- On Linux/Windows, credentials are stored in `~/.config/porkbun-mcp/credentials.json` with owner-only file permissions (600)
- Environment variables are checked first if you prefer that approach
- Credentials are never passed as tool arguments or included in error output
- The server communicates over local stdio only
