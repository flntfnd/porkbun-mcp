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

## Credential setup

Run the setup script to save your API keys to your shell profile:

```sh
npm run setup
```

It will detect your shell profile (`.zshrc`, `.bash_profile`, etc.), prompt for your keys with masked input, and write them to the file. If keys are already there, it will ask before overwriting.

Once that's done, reload your profile:

```sh
source ~/.zshrc   # or ~/.bash_profile, etc.
```

Verify it worked:

```sh
echo $PORKBUN_API_KEY
```

If you'd rather do it manually, add these two lines to your shell profile:

```sh
export PORKBUN_API_KEY="your_api_key"
export PORKBUN_SECRET_KEY="your_secret_key"
```

## MCP client config

Add this to your MCP client config under `mcpServers`:

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
