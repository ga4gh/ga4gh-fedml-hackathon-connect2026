# GA4GH Passport Broker

This is a **GA4GH Passport Broker** demonstration setup for the Connect2026 hackathon.
It runs [Ory Hydra v26.2.0](https://www.ory.com/docs/hydra/) as the OIDC/OAuth2 server
that issues GA4GH Passport visas.

**This setup is for demonstration purposes only — not production.**

## Getting started

Prerequisites: docker, jq

Run Ory Hydra and create a passport broker client.

1. Clone ory/hydra locally.

2. Start OIDC provider.

```sh
# from ory/hydra root directory
docker compose -f quickstart.yml up
```

3. Create clients, adding the ga4gh_passport_v1 scope

4. Stop and destroy the broker.

```sh
docker compose -f quickstart.yml kill
docker compose -f quickstart.yml rm -f -v
```

## Stack

- **Ory Hydra v26.2.0** — OIDC/OAuth2 authorization server (public port 4444, admin port 4445)
- **hydra-login-consent-node v26.2.0** — Login and consent UI (port 3000)
- **SQLite** — Backing store via a busybox volume at `/mnt/sqlite/db.sqlite`

### Ory Hydra

[Hydra config reference](https://www.ory.com/docs/hydra/reference/configuration).

### Hydra CLI via Docker

```sh
alias hydra='docker compose exec hydra hydra'
hydra <subcommand> [flags]
```

### Create a client_credentials client

```sh
hydra \
    create client \
    --endpoint http://127.0.0.1:4445/ \
    --format json \
    --grant-type client_credentials
```

### Create an authorization_code client

```sh
hydra \
    --grant-type authorization_code,refresh_token \
    --response-type code,id_token \
    --format json \
    --scope openid --scope ga4gh_passport_v1 \
    --redirect-uri http://127.0.0.1:5555/callback
```

### Token exchange

(soon) Using type `urn:ga4gh:params:oauth:token-type:passport`
