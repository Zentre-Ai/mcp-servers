# MCP Server - Zoho Books

An MCP (Model Context Protocol) server for integrating with Zoho Books accounting and finance platform. Supports OAuth 2.0 authentication and multi-datacenter deployment.

## Features

- **OAuth 2.0 Authentication**: Secure authentication using Zoho's OAuth 2.0 flow
- **Multi-Datacenter Support**: Works with all 6 Zoho datacenters (US, EU, India, Australia, Japan, China)
- **Complete API Coverage**: Invoices, contacts, bills, expenses, items, and organizations
- **MCP Compatible**: Works with Claude Desktop, Cursor, VS Code, and other MCP clients

## Quick Start

### 1. Create a Zoho OAuth App

1. Visit [api-console.zoho.com](https://api-console.zoho.com)
2. Click **Add Client** > **Server-based Applications**
3. Configure your app:
   - **Client Name**: Your app name
   - **Homepage URL**: Your website URL
   - **Authorized Redirect URIs**: `http://localhost:3007/oauth/callback`
4. Add scopes: `ZohoBooks.fullaccess.all` (or specific scopes as needed)
5. Copy your **Client ID** and **Client Secret**

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Zoho OAuth credentials
```

### 3. Run the Server

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Or production mode
npm run build && npm start
```

### 4. Complete OAuth Flow

1. Get authorization URL:
   ```bash
   curl "http://localhost:3007/oauth/authorize?dc=com"
   ```

2. Visit the returned URL in your browser and grant permissions

3. Exchange the code for tokens:
   ```bash
   curl -X POST "http://localhost:3007/oauth/callback" \
     -H "Content-Type: application/json" \
     -d '{
       "code": "<authorization_code>",
       "redirectUri": "http://localhost:3007/oauth/callback",
       "datacenter": "com"
     }'
   ```

4. Use the tokens with MCP:
   ```bash
   curl -X POST "http://localhost:3007/mcp" \
     -H "Authorization: Zoho-oauthtoken <access_token>" \
     -H "x-zoho-organization-id: <organization_id>" \
     -H "x-zoho-datacenter: com" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
   ```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/datacenters` | GET | List available datacenters |
| `/oauth/authorize` | GET | Get authorization URL |
| `/oauth/callback` | POST | Exchange code for tokens |
| `/oauth/refresh` | POST | Refresh access token |
| `/oauth/organizations` | GET | List user's organizations |
| `/mcp` | POST | MCP transport endpoint |

## Available Tools

### Invoices (6 tools)
- `zoho_books_list_invoices` - List invoices with filters
- `zoho_books_get_invoice` - Get invoice details
- `zoho_books_create_invoice` - Create a new invoice
- `zoho_books_update_invoice` - Update an invoice
- `zoho_books_delete_invoice` - Delete an invoice
- `zoho_books_email_invoice` - Email invoice to customer

### Contacts (5 tools)
- `zoho_books_list_contacts` - List contacts (customers/vendors)
- `zoho_books_get_contact` - Get contact details
- `zoho_books_create_contact` - Create a new contact
- `zoho_books_update_contact` - Update a contact
- `zoho_books_delete_contact` - Delete a contact

### Bills (5 tools)
- `zoho_books_list_bills` - List bills with filters
- `zoho_books_get_bill` - Get bill details
- `zoho_books_create_bill` - Create a new bill
- `zoho_books_update_bill` - Update a bill
- `zoho_books_delete_bill` - Delete a bill

### Expenses (4 tools)
- `zoho_books_list_expenses` - List expenses with filters
- `zoho_books_get_expense` - Get expense details
- `zoho_books_create_expense` - Create a new expense
- `zoho_books_delete_expense` - Delete an expense

### Items (4 tools)
- `zoho_books_list_items` - List items/products
- `zoho_books_get_item` - Get item details
- `zoho_books_create_item` - Create a new item
- `zoho_books_update_item` - Update an item

### Organizations (2 tools)
- `zoho_books_get_organization` - Get organization details
- `zoho_books_list_organizations` - List all organizations

## Multi-Datacenter Support

Zoho operates in multiple geographic datacenters. Use the appropriate datacenter for your region:

| Datacenter | Region | Accounts Domain |
|------------|--------|-----------------|
| `com` | United States | accounts.zoho.com |
| `eu` | Europe | accounts.zoho.eu |
| `in` | India | accounts.zoho.in |
| `com.au` | Australia | accounts.zoho.com.au |
| `jp` | Japan | accounts.zoho.jp |
| `com.cn` | China | accounts.zoho.com.cn |

Specify datacenter in:
- OAuth authorize: `?dc=eu`
- Token exchange: `"datacenter": "eu"`
- MCP requests: `x-zoho-datacenter: eu`

## MCP Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Zoho-oauthtoken <access-token>` |
| `x-zoho-organization-id` | Yes | Organization ID from /oauth/organizations |
| `x-zoho-datacenter` | No | Datacenter code (default: `com`) |

## Docker Deployment

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port |
| `LOG_LEVEL` | No | info | Logging level |
| `ZOHO_CLIENT_ID` | Yes* | - | OAuth client ID |
| `ZOHO_CLIENT_SECRET` | Yes* | - | OAuth client secret |
| `ZOHO_CLIENT_SECRET_EU` | No | - | EU datacenter secret |
| `ZOHO_CLIENT_SECRET_IN` | No | - | India datacenter secret |
| `ZOHO_CLIENT_SECRET_AU` | No | - | Australia datacenter secret |
| `ZOHO_CLIENT_SECRET_JP` | No | - | Japan datacenter secret |
| `ZOHO_CLIENT_SECRET_CN` | No | - | China datacenter secret |
| `OAUTH_REDIRECT_URI` | No | - | OAuth redirect URI |
| `OAUTH_SCOPES` | No | ZohoBooks.fullaccess.all | OAuth scopes |

*Required for OAuth flow endpoints

## License

MIT
