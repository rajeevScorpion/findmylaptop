# 09 — Product Card Blocks Future Provision

## Objective

Prepare blog content for future product card insertion without forcing full product integration in MVP.

## Critical rule

AI must not invent product specs, prices, availability, ratings, reviews, discounts, or affiliate claims.

All product facts must come from:

- existing LaptopFinder product database
- admin-selected product records
- verified product feed integration
- admin-entered data

## MVP requirement

Add block types that can be stored/rendered safely:

```text
product_card_placeholder
product_grid_placeholder
comparison_card_placeholder
```

These can be inserted by AI as recommendations for where product cards should go.

## Suggested placeholder block

```json
{
  "type": "product_grid_placeholder",
  "data": {
    "title": "Recommended laptops for B.Tech CSE students under ₹60,000",
    "filterIntent": "btech_cse_under_60000",
    "limit": 4,
    "notes": "Use real LaptopFinder product data only."
  }
}
```

## Future product card block

```json
{
  "type": "product_card",
  "data": {
    "productId": "existing-product-id",
    "displayMode": "compact",
    "reason": "Good for coding and general college use"
  }
}
```

## Future product grid block

```json
{
  "type": "product_grid",
  "data": {
    "filter": {
      "budgetMax": 60000,
      "useCase": "coding",
      "audience": "student",
      "minRamGb": 16,
      "minStorageGb": 512
    },
    "limit": 4
  }
}
```

## Future comparison block

```json
{
  "type": "product_comparison",
  "data": {
    "productIds": ["id-1", "id-2"],
    "criteria": ["processor", "ram", "battery", "weight", "service"]
  }
}
```

## Admin UI provision

In editor, later allow:

- Insert single product
- Insert product grid by filter
- Insert comparison
- Replace placeholder with selected products

For MVP, show placeholder with message:

```text
Product cards can be added here later from LaptopFinder product listings.
```

## Public rendering

If product block feature is off:

- Hide block or show neutral CTA.
- Do not expose broken UI.

If product ID is missing:

- Render fallback.
- Log warning.
- Do not crash page.

## SEO rule

Do not add Product schema unless a real product card with real visible product data is rendered.
