# MyMerca — Master Logic Document (sample: catalog module only)

## FID03 — 3-Tier Product Catalog & Cartesian Variants

### 6. Acceptance Criteria

1. A vendor can create a product only under a Tier-3 leaf category, with variants, within the plan quota.

## FID03.1 — 3-Tier Hierarchy & Strict Leaf Category Binding

### 5. Outcomes, UI Behaviour and Failures

| Scenario | Condition | Expected behaviour |
|---|---|---|
| Parent category chosen | Vendor selects a Tier 1 or Tier 2 node | Save is blocked with a validation error |

### 6. Acceptance Criteria

1. Parent nodes cannot be bound to products.
2. A product saves when a Tier-3 leaf category is selected.

## FID03.2 — Cartesian Variant Generator & Uniform Pricing

### 6. Acceptance Criteria

1. The engine generates one variant row per attribute combination, each with an auto-generated SKU.
2. An overridden variant price persists after save.

## FID03.3 — Stock Toggles, Listing Quotas & Moderation

### 6. Acceptance Criteria

1. Publishing beyond the plan's product quota is blocked by the Quota Gate.
2. Toggling stock updates the public catalog badge immediately.

## FID03.4 — Vendor Missing Category & Variant Request Queue

### 6. Acceptance Criteria

1. A category request is written to category_requests.
2. On admin approval the leaf node is added to the taxonomy and the vendor is notified.
