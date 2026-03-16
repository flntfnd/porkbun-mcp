# Porkbun DNS MCP Server

A local [Model Context Protocol](https://modelcontextprotocol.io) server for managing Porkbun DNS through any MCP-compatible AI client. It runs as a local stdio process and is never exposed to the network.

## Requirements

- Node.js 18+
- A Porkbun account with API access enabled
- Your Porkbun API key and secret key ([grab them here](https://porkbun.com/account/api))

## Installation

```sh
git clone https://github.com/flntfnd/porkbun-mcp.git
cd porkbun-mcp
npm install
```

## Setup

Run the setup script:

```sh
npm run setup
```

It will:
1. Prompt for your Porkbun API key and secret key (input is masked)
2. Write the keys to your shell profile (`.zshrc`, `.bash_profile`, etc.)
3. Register the MCP server in `~/.claude.json` automatically

After it finishes, reload your shell profile:

```sh
source ~/.zshrc   # or ~/.bash_profile, etc.
```

Then restart your MCP client and run `/mcp` to confirm the server is listed.

### Manual setup

If you'd rather configure things by hand, add your keys to your shell profile:

```sh
export PORKBUN_API_KEY="your_api_key"
export PORKBUN_SECRET_KEY="your_secret_key"
```

Then add this block to `~/.claude.json` under `mcpServers`:

```json
"porkbun-dns": {
  "command": "node",
  "args": ["/absolute/path/to/porkbun-mcp/index.js"],
  "env": {
    "PORKBUN_API_KEY": "your_api_key",
    "PORKBUN_SECRET_KEY": "your_secret_key"
  }
}
```

Note: the `env` block in `~/.claude.json` requires literal values. Shell variable syntax like `${PORKBUN_API_KEY}` is not expanded there.

## Available tools

| Tool | Description |
|---|---|
| `list_domains` | List all domains on the account with expiry dates |
| `list_dns_records` | List all DNS records for a domain |
| `create_dns_record` | Create a new DNS record |
| `edit_dns_record` | Edit an existing record by ID |
| `delete_dns_record` | Delete a record by ID |

Supported record types: `A`, `AAAA`, `MX`, `CNAME`, `TXT`, `NS`, `SRV`, `CAA`, `ALIAS`, `TLSA`

Records are returned in a readable format:

```
[A]     www.example.com -> 203.0.113.10  (TTL 300,  ID 123456)
[MX]    example.com     -> mail.example.com (TTL 3600, ID 123457, priority=10)
[TXT]   example.com     -> v=spf1 include:example.net ~all (TTL 300, ID 123458)
```

## Security

- Credentials are read from environment variables only and never passed as tool arguments
- Domain names and record types are validated before any API call is made
- Credentials are never included in error messages or tool output
- The server communicates over local stdio only
