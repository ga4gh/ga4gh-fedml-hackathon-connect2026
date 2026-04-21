# DRS Mock

DRS 1.5 server with test data built in for use with integration testing
and ecosystem experimentation.

## Usage

### 1. Install dependencies

From `01-access-data-compute/drs-mock`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Run the server

Default run (serves files from `./data` on port `8080`):

```bash
python main.py
```

Equivalent `uvicorn` command:

```bash
uvicorn main:app --host 0.0.0.0 --port 8080
```

### 3. Configure host, port, and data directory

The server reads these environment variables:

`DRS_DATA_DIR` points to the directory containing files to expose as DRS
objects. Default: `data`.

`DRS_HOST` is the hostname used when building `self_uri` and access URLs.
Default: `localhost`.

`DRS_PORT` is the port used by the server and public URLs. Default:
`8080`.

`DRS_CORS_ORIGINS` is a comma-separated list of browser origins allowed
to call the API from a frontend app. Default:
`http://localhost:5173,http://127.0.0.1:5173`.

Example:

```bash
DRS_DATA_DIR=./data DRS_HOST=127.0.0.1 DRS_PORT=8090 python main.py
```

If you run the `compute` app on a different origin during development,
include it in `DRS_CORS_ORIGINS`:

```bash
DRS_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 python main.py
```

### 4. Verify endpoints

With defaults (`localhost:8080`):

```bash
# Service metadata
curl http://localhost:8080/ga4gh/drs/v1/service-info

# Non-standard convenience listing endpoint
curl http://localhost:8080/ga4gh/drs/v1/objects
```

### 5. Built-in test files and DRS object IDs

Object IDs are the SHA-256 digest of file contents.

| File | DRS Object ID (SHA-256) |
| --- | --- |
| `data/alice.tsv` | `ee7b2550261f8b0bb5c581c16d5edf6b372247fc61c7e6bf188a390cd25a7850` |
| `data/alice.vcf` | `d3d001c6afafe931c8f4f07fceda56ed5d663b0beb44aa78bba56a33a1dd8ad2` |
| `data/bob.tsv` | `286278306d7a8e6e0b8af4832c662ff922d58d0f46704cc32a00fecc353ce594` |
| `data/bob.vcf` | `536e13fc852c2d5714a61c1061acf290415ef4d001b61c4d6a41ffc596678ed9` |

### 6. Retrieve an object and download it

Example for `data/alice.tsv`:

```bash
OID=ee7b2550261f8b0bb5c581c16d5edf6b372247fc61c7e6bf188a390cd25a7850

# Get DRS object metadata
curl "http://localhost:8080/ga4gh/drs/v1/objects/${OID}"

# Resolve access URL (access_id is always local-https in this mock)
curl "http://localhost:8080/ga4gh/drs/v1/objects/${OID}/access/local-https"

# Direct file download path
curl -OJ "http://localhost:8080/files/${OID}/alice.tsv"
```

## Notes

The `/ga4gh/drs/v1/objects` endpoint is a convenience endpoint and not
part of the DRS specification.

Access control is intentionally not enforced in this mock; requests are
logged for testing and experimentation.
