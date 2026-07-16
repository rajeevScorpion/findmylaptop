# Environment Variables and Secrets Checklist

Use exact names that match the project conventions. These are suggested names only.

## Core

```text
AGENTS_ENABLED=
AGENT_SAFE_MODE=
AGENT_CRON_SECRET=
AGENT_LOG_LEVEL=
```

## LLM

```text
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL_RESEARCH=
LLM_MODEL_BLOGGING=
LLM_MODEL_CHIP=
```

## Amazon

```text
AMAZON_AFFILIATE_ENABLED=
AMAZON_MARKETPLACE=IN
AMAZON_ASSOCIATE_TAG=
AMAZON_CREATORS_API_ENABLED=
AMAZON_CREATORS_API_CLIENT_ID=
AMAZON_CREATORS_API_CLIENT_SECRET=
AMAZON_PAAPI_ACCESS_KEY=
AMAZON_PAAPI_SECRET_KEY=
AMAZON_PAAPI_DEPRECATED_DO_NOT_USE_WITHOUT_REVIEW=
```

## Flipkart

```text
FLIPKART_AFFILIATE_ENABLED=
FLIPKART_AFFILIATE_ID=
FLIPKART_AFFILIATE_TOKEN=
```

## Other sources

```text
CUELINKS_ENABLED=
CUELINKS_API_KEY=
OTHER_AFFILIATE_NETWORK_ENABLED=
```

## Ads

```text
ADS_ENABLED=
AD_PROVIDER=
AD_CLIENT_ID=
```

## Analytics

```text
GA_MEASUREMENT_ID=
SEARCH_CONSOLE_ENABLED=
AFFILIATE_CLICK_SALT=
```

## Security rules

- Keep secrets server-side.
- Do not expose `*_TOKEN`, `*_SECRET`, `*_KEY` variables to the browser.
- Never commit `.env` files.
- Add `.env.example` with blank values only.
- Mask secrets in logs.
