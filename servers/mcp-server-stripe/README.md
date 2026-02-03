# MCP Server for Stripe

MCP (Model Context Protocol) server for Stripe with OAuth 2.0 (Stripe Connect) authentication. This server enables AI assistants to interact with Stripe APIs for managing customers, payments, subscriptions, invoices, products, prices, and balances.

## Features

- **OAuth 2.0 Authentication**: Full Stripe Connect OAuth flow support
- **Customer Management**: Create, update, delete, list, and search customers
- **Payment Intents**: Create, confirm, capture, and cancel payments
- **Subscriptions**: Create, update, cancel, and manage recurring billing
- **Invoices**: Create, finalize, pay, send, and void invoices
- **Products & Prices**: Manage your product catalog and pricing
- **Balance & Payouts**: View balances and manage payouts
- **Connected Accounts**: Support for platform/marketplace operations

## Quick Start

### Prerequisites

- Node.js 20+
- Stripe account with API keys
- For OAuth: Stripe Connect platform configured

### Installation

```bash
cd servers/mcp-server-stripe
npm install
```

### Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# Server Configuration
PORT=3000
LOG_LEVEL=info

# Stripe OAuth 2.0 (Stripe Connect)
STRIPE_CLIENT_ID=ca_xxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
OAUTH_SCOPES=read_write
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Docker
docker-compose up
```

## API Endpoints

### Health Check

```bash
GET /health
```

### OAuth 2.0 Flow

#### 1. Get Authorization URL

```bash
GET /oauth/authorize?redirect_uri=http://localhost:3000/callback
```

Response:
```json
{
  "authorizationUrl": "https://connect.stripe.com/oauth/authorize?...",
  "state": "random-state-string",
  "redirectUri": "http://localhost:3000/callback"
}
```

#### 2. Exchange Code for Tokens

```bash
POST /oauth/callback
Content-Type: application/json

{
  "code": "ac_xxx"
}
```

Response:
```json
{
  "accessToken": "sk_live_xxx",
  "refreshToken": "rt_xxx",
  "tokenType": "bearer",
  "stripeUserId": "acct_xxx",
  "stripePublishableKey": "pk_live_xxx",
  "scope": "read_write",
  "livemode": false
}
```

#### 3. Refresh Token

```bash
POST /oauth/refresh
Content-Type: application/json

{
  "refreshToken": "rt_xxx"
}
```

#### 4. Deauthorize (Revoke Access)

```bash
POST /oauth/deauthorize
Content-Type: application/json

{
  "stripeUserId": "acct_xxx"
}
```

#### 5. Get Account Info

```bash
GET /oauth/account
Authorization: Bearer sk_live_xxx
```

### MCP Protocol

```bash
POST /mcp
Authorization: Bearer sk_live_xxx
x-stripe-account: acct_xxx  # Optional, for connected accounts
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "stripe_list_customers",
    "arguments": {}
  },
  "id": 1
}
```

## Available Tools

### Customers

| Tool | Description |
|------|-------------|
| `stripe_list_customers` | List customers with pagination and filters |
| `stripe_get_customer` | Get a customer by ID |
| `stripe_create_customer` | Create a new customer |
| `stripe_update_customer` | Update an existing customer |
| `stripe_delete_customer` | Delete a customer |
| `stripe_search_customers` | Search customers using Stripe's query language |

### Payment Intents

| Tool | Description |
|------|-------------|
| `stripe_list_payment_intents` | List payment intents with filters |
| `stripe_get_payment_intent` | Get a payment intent by ID |
| `stripe_create_payment_intent` | Create a new payment intent |
| `stripe_confirm_payment_intent` | Confirm a payment intent |
| `stripe_cancel_payment_intent` | Cancel a payment intent |
| `stripe_capture_payment_intent` | Capture a payment intent (manual capture) |
| `stripe_search_payment_intents` | Search payment intents |

### Subscriptions

| Tool | Description |
|------|-------------|
| `stripe_list_subscriptions` | List subscriptions with filters |
| `stripe_get_subscription` | Get a subscription by ID |
| `stripe_create_subscription` | Create a new subscription |
| `stripe_update_subscription` | Update a subscription |
| `stripe_cancel_subscription` | Cancel a subscription |
| `stripe_resume_subscription` | Resume a paused subscription |
| `stripe_search_subscriptions` | Search subscriptions |

### Invoices

| Tool | Description |
|------|-------------|
| `stripe_list_invoices` | List invoices with filters |
| `stripe_get_invoice` | Get an invoice by ID |
| `stripe_create_invoice` | Create a draft invoice |
| `stripe_create_invoice_item` | Add an item to an invoice |
| `stripe_finalize_invoice` | Finalize a draft invoice |
| `stripe_pay_invoice` | Pay an invoice |
| `stripe_send_invoice` | Send an invoice for payment |
| `stripe_void_invoice` | Void an invoice |
| `stripe_search_invoices` | Search invoices |

### Products

| Tool | Description |
|------|-------------|
| `stripe_list_products` | List products with filters |
| `stripe_get_product` | Get a product by ID |
| `stripe_create_product` | Create a new product |
| `stripe_update_product` | Update a product |
| `stripe_delete_product` | Delete a product |
| `stripe_search_products` | Search products |

### Prices

| Tool | Description |
|------|-------------|
| `stripe_list_prices` | List prices with filters |
| `stripe_get_price` | Get a price by ID |
| `stripe_create_price` | Create a new price |
| `stripe_update_price` | Update a price |
| `stripe_search_prices` | Search prices |

### Balance & Payouts

| Tool | Description |
|------|-------------|
| `stripe_get_balance` | Get account balance |
| `stripe_list_balance_transactions` | List balance transactions |
| `stripe_get_balance_transaction` | Get a balance transaction by ID |
| `stripe_list_payouts` | List payouts with filters |
| `stripe_get_payout` | Get a payout by ID |
| `stripe_create_payout` | Create a payout |
| `stripe_cancel_payout` | Cancel a payout |

## Usage Examples

### Create a Customer

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "stripe_create_customer",
    "arguments": {
      "email": "customer@example.com",
      "name": "John Doe",
      "description": "Premium customer"
    }
  },
  "id": 1
}
```

### Create a Payment Intent

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "stripe_create_payment_intent",
    "arguments": {
      "amount": 2000,
      "currency": "usd",
      "customer": "cus_xxx",
      "description": "Order #123"
    }
  },
  "id": 1
}
```

### Create a Subscription

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "stripe_create_subscription",
    "arguments": {
      "customer": "cus_xxx",
      "items": [
        { "price": "price_xxx" }
      ]
    }
  },
  "id": 1
}
```

### Search Customers

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "stripe_search_customers",
    "arguments": {
      "query": "email:'test@example.com'"
    }
  },
  "id": 1
}
```

## Stripe Connect (Platform Operations)

For platform/marketplace operations with connected accounts, include the `x-stripe-account` header:

```bash
POST /mcp
Authorization: Bearer sk_live_platform_xxx
x-stripe-account: acct_connected_xxx
```

This will make API calls on behalf of the connected account.

## Docker Deployment

```bash
# Build and run
docker-compose up --build

# Run in background
docker-compose up -d
```

The server will be available at `http://localhost:3010`.

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test
```

## Security Considerations

1. **API Keys**: Never expose your Stripe secret key in client-side code
2. **OAuth State**: Always validate the state parameter to prevent CSRF attacks
3. **Webhooks**: Consider implementing Stripe webhooks for real-time updates
4. **Rate Limits**: Be aware of Stripe's rate limits (100 requests/second for most APIs)
5. **Connected Accounts**: Validate connected account permissions before operations

## License

MIT
