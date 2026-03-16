# Porkbun DNS MCP Server

A local [Model Context Protocol](https://modelcontextprotocol.io) server that provides structured access to the [Porkbun](https://porkbun.com) domain registrar API for DNS management.

Runs as a local stdio process — never exposed to the network.

## Requirements

- Node.js 18+
- A Porkbun account with API access enabled
- Porkbun API key and secret key ([get them here](https://porkbun.com/account/api))

## Installation

```sh
git clone https://github.com/flntfnd/porkbun-mcp.git
cd porkbun-mcp
npm install
```

## Credential setup

Run the interactive setup script to write your API keys to your shell profile:

```sh
npm run setup
```

The script will:
1. Detect your shell profile (`.zshrc`, `.bash_profile`, etc.) — you can override it
2. Prompt for your API key and secret (input is masked)
3. Append a clearly-marked block to the profile, or replace it if keys already exist

After setup, reload your profile:

```sh
source ~/.zshrc   # or ~/.bash_profile, etc.
```

To verify the keys are set:

```sh
echo $PORKBUN_API_KEY
```

> **Manual alternative:** Add these lines to your shell profile yourself:
> ```sh
> export PORKBUN_API_KEY="your_api_key"
> export PORKBUN_SECRET_KEY="your_secret_key"
> ```

## Register with your MCP client

Add the following to your MCP client config under `mcpServers`:

```json
{
  "mcpServers": {
    "porkbun-dns": {
      "command": "node",
      "args": ["/path/to/porkbun-mcp/index.js"],
      "env": {
        "PORKBUN_API_KEY": "${PORKBUN_API_KEY}",
        "PORKBUN_SECRET_KEY": "${PORKBUN_SECRET_KEY}"
      }
    }
  }
}
```

Replace `/path/to/porkbun-mcp` with the absolute path to this directory.

## Available tools

| Tool | Description |
|---|---|
| `list_domains` | List all domains on the account with expiry dates |
| `list_dns_records` | List all DNS records for a domain |
| `create_dns_record` | Create a new DNS record |
| `edit_dns_record` | Edit an existing record by ID |
| `delete_dns_record` | Delete a record by ID |

Supported record types: `A`, `AAAA`, `MX`, `CNAME`, `TXT`, `NS`, `SRV`, `CAA`, `ALIAS`, `TLSA`

Example output from `list_dns_records`:

```
[A]     www.example.com → 203.0.113.10  (TTL 300,  ID 123456)
[MX]    example.com     → mail.example.com (TTL 3600, ID 123457, priority=10)
[TXT]   example.com     → v=spf1 include:example.net ~all (TTL 300, ID 123458)
```

## Security notes

- API credentials are read exclusively from environment variables — never passed as tool arguments
- Domain names and record types are validated before any API call is made
- Credentials are never included in error messages or tool output
- The server communicates only over local stdio — no network exposure
