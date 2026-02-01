# MCP Server - Zoho People

An MCP (Model Context Protocol) server for integrating with Zoho People HR management platform. Supports OAuth 2.0 authentication and multi-datacenter deployment.

## Features

- **OAuth 2.0 Authentication**: Secure authentication using Zoho's OAuth 2.0 flow
- **Multi-Datacenter Support**: Works with all 6 Zoho datacenters (US, EU, India, Australia, Japan, China)
- **Complete HR Coverage**: Employees, attendance, leave management, and custom forms
- **MCP Compatible**: Works with Claude Desktop, Cursor, VS Code, and other MCP clients

## Quick Start

### 1. Create a Zoho OAuth App

1. Visit [api-console.zoho.com](https://api-console.zoho.com)
2. Click **Add Client** > **Server-based Applications**
3. Configure your app:
   - **Client Name**: Your app name
   - **Homepage URL**: Your website URL
   - **Authorized Redirect URIs**: `http://localhost:3008/oauth/callback`
4. Add scopes:
   - `ZOHOPEOPLE.forms.ALL`
   - `ZOHOPEOPLE.employee.ALL`
   - `ZOHOPEOPLE.attendance.ALL`
   - `ZOHOPEOPLE.leave.ALL`
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
   curl "http://localhost:3008/oauth/authorize?dc=com"
   ```

2. Visit the returned URL in your browser and grant permissions

3. Exchange the code for tokens:
   ```bash
   curl -X POST "http://localhost:3008/oauth/callback" \
     -H "Content-Type: application/json" \
     -d '{
       "code": "<authorization_code>",
       "redirectUri": "http://localhost:3008/oauth/callback",
       "datacenter": "com"
     }'
   ```

4. Use the tokens with MCP:
   ```bash
   curl -X POST "http://localhost:3008/mcp" \
     -H "Authorization: Zoho-oauthtoken <access_token>" \
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
| `/mcp` | POST | MCP transport endpoint |

## Available Tools

### Employees (5 tools)
- `zoho_people_list_employees` - List employees with filters
- `zoho_people_get_employee` - Get employee details
- `zoho_people_add_employee` - Add a new employee
- `zoho_people_update_employee` - Update an employee
- `zoho_people_search_employees` - Search employees by criteria

### Attendance (5 tools)
- `zoho_people_checkin` - Record employee check-in
- `zoho_people_checkout` - Record employee check-out
- `zoho_people_get_attendance` - Get attendance for an employee
- `zoho_people_get_attendance_report` - Get attendance report
- `zoho_people_bulk_import_attendance` - Bulk import attendance records

### Leave (5 tools)
- `zoho_people_list_leave_types` - List available leave types
- `zoho_people_get_leave_balance` - Get leave balance for employee
- `zoho_people_apply_leave` - Apply for leave
- `zoho_people_get_leave_requests` - Get leave requests
- `zoho_people_approve_leave` - Approve or reject leave request

### Forms (4 tools)
- `zoho_people_list_forms` - List available forms
- `zoho_people_get_form_records` - Get records from a form
- `zoho_people_add_form_record` - Add a record to a form
- `zoho_people_update_form_record` - Update a form record

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
| `OAUTH_SCOPES` | No | (see .env.example) | OAuth scopes |

*Required for OAuth flow endpoints

## License

MIT
