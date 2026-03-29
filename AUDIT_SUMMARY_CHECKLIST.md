# Audit Summary Checklist

Based on the summary table in `NMPL Ecom v12 Full Security Audit.pdf`.

Verification basis: current codebase and current git tracked-file state.

`[x]` means verified resolved in the current repo state. External operational actions like secret rotation or git-history scrubbing still need separate confirmation where applicable.

## Critical

- [x] `#1` `src/.env`: Hardcoded DB credentials in Git
- [x] `#2` `src/docker-compose.yml`: Credentials in Compose + open ports
- [x] `#3` `src/server/src/modules/attribute/attribute.routes.ts`: No auth on attribute CRUD
- [x] `#4` `src/server/src/modules/variant/variant.routes.ts`: No auth on variant CRUD
- [x] `#5` `src/server/src/modules/payment/payment.routes.ts`: Payment delete IDOR
- [x] `#6` `src/server/src/modules/payment/razorpayGateway.service.ts`: Timing-unsafe signature check

## High

- [x] `#7` `src/server/src/modules/auth/auth.routes.ts`: GET sign-out CSRF logout
- [x] `#8` `src/server/src/modules/section/section.routes.ts`: No auth on section CRUD
- [x] `#9` `src/server/src/modules/logs/logs.routes.ts`: No auth on log access/delete
- [x] `#10` `src/server/src/graphql/index.ts`: Introspection enabled in production
- [x] `#11` `src/server/src/graphql/index.ts`: Batched requests bypass rate limits
- [x] `#12` `src/server/src/shared/utils/ApiFeatures.ts`: Arbitrary sort fields

## Medium

- [x] `#13` `src/server/src/app.ts`: Helmet only in production
- [x] `#14` `src/server/src/shared/middlewares/csrfProtection.ts`: CSRF token not rotated post-auth
- [x] `#15` `src/server/src/modules/payment/payment.routes.ts`: Gateway config unauthenticated
- [x] `#16` `src/server/src/modules/product/product.routes.ts`: `upload.any()` on product create
- [x] `#17` `src/server/src/modules/chat/chat.routes.ts`: No chat ownership verification
- [x] `#18` `src/server/src/modules/payment/razorpayGateway.service.ts`: Mock mode in production risk
- [x] `#19` `src/server/src/graphql/index.ts`: No query complexity limit
- [x] `#20` `src/server/src/shared/errors/globalError.ts`: Stack traces in dev responses
- [x] `#21` `src/server/src/shared/utils/ApiFeatures.ts`: Arbitrary filter fields
- [x] `#22` `src/server/src/shared/utils/ApiFeatures.ts`: No pagination cap
- [x] `#23` `src/server/src/shared/utils/searchModel.ts`: Dynamic Prisma model access
- [x] `#24` `src/server/src/modules/product/bulk-import.service.ts`: MIME-only file validation
- [x] `#25` `src/client/app/hooks/network/useSocket.ts`: WebSocket has no auth
- [x] `#26` `src/server/src/modules/chat/chat.service.ts`: File upload type inconsistency

## Low

- [x] `#27` `src/server/src/modules/analytics/graphql/resolver.ts`: Uses `role` instead of `effectiveRole`
- [x] `#28` `src/server/src/shared/errors/globalError.ts`: Prisma error messages leak schema info
- [x] `#29` `src/server/src/shared/utils/sendSms.ts`: OTP logged in `LOG` mode
- [x] `#30` `src/client/app/lib/apolloClient.ts`: Client batching compounds server batching issue
- [x] `#31` `src/server/src/shared/middlewares/deviceDetection.ts`: Device info in response headers
- [x] `#32` `src/server/src/shared/constants/index.ts`: Cookie `maxAge` vs token TTL mismatch

## Info

- [x] `#33` `src/server/src/app.ts`: Private network access header should stay disabled in production
- [x] `#34` `src/server/.env.example`: Mock secrets in example file are documented and acceptable

## Audit Order

- [x] Immediate: `#1`, `#2`, `#3`, `#4`, `#5`, `#6`, `#8`, `#9`
- [x] This week: `#7`, `#10`, `#11`
- [x] This sprint: `#12`, `#17`, `#21`, `#22`, `#25`
- [x] Backlog review: `#13`, `#14`, `#15`, `#16`, `#18`, `#19`, `#20`, `#23`, `#24`, `#26`, `#27`, `#28`, `#29`, `#30`, `#31`, `#32`, `#33`, `#34`
