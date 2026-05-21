# Making Workflow Output Findable for Federated Learning Using RO-Crate

Federated learning and broader federated analytics depend on the ability to discover relevant results across multiple sites without centralizing sensitive data. In many scientific and regulated environments, workflows are executed locally where the data resides, while only approved outputs and metadata are shared externally.

A recurring problem is that workflow outputs often remain difficult to find, interpret, and reuse. Files may exist, but without structured metadata it is unclear:

- what workflow produced them
- which workflow version was used
- what parameters were applied
- whether outputs are comparable across sites
- whether results are reproducible
- whether outputs can legally or operationally be reused

A practical solution is to generate RO-Crates automatically after workflow execution. Many workflow engines already provide built-in provenance features or plugin mechanisms that can support RO-Crate generation. The crate then acts as a standardized metadata package describing workflow outputs and their provenance.

In a federated learning setting, sites can publish or index RO-Crate metadata while retaining control over underlying sensitive data.

## How This Supports Findability

After each workflow run:
```
Workflow executed locally
        ↓
Outputs produced
        ↓
RO-Crate generated
        ↓
Metadata indexed in federation catalog
        ↓
Other sites discover compatible outputs
```

This enables queries such as:

- Find all GWAS summary statistics produced with workflow version X
- Find outputs generated with identical preprocessing pipeline
- Find models trained on cohort type Y
- Find runs based on trusted TRS-registered workflow versions
- Find results reproducible under specific container image versions

Example RO-Crate Structure
```
run-2026-001/
 ├ outputs/
 │   ├ model.bin
 │   ├ metrics.json
 │   └ report.pdf
 ├ logs/
 └ ro-crate-metadata.json
```

## Example RO-Crate Metadata (Simplified)
```json
{
  "@context": "https://w3id.org/ro/crate/1.1/context",
  "@graph": [
    {
      "@id": "./",
      "@type": "Dataset",
      "name": "Federated workflow run outputs"
    },
    {
      "@id": "#workflow",
      "@type": "ComputationalWorkflow",
      "name": "Preprocessing + Training Pipeline",
      "programmingLanguage": "Nextflow",
      "identifier": "trs://workflowhub.eu/123/1.2.0"
    },
    {
      "@id": "#run",
      "@type": "CreateAction",
      "instrument": { "@id": "#workflow" },
      "actionStatus": "CompletedActionStatus"
    },
    {
      "@id": "outputs/model.bin",
      "@type": "File",
      "name": "Trained model artifact"
    }
  ]
}
```

## Example: Including a TRS Reference

To make outputs strongly discoverable, include the workflow registry identifier.

```json
{
  "@id": "#workflow",
  "@type": "ComputationalWorkflow",
  "name": "Variant Calling Pipeline",
  "identifier": "trs://workflowhub.eu/456/2.1.0",
  "sameAs": "https://workflowhub.eu/workflows/456?version=2.1.0"
}
```
This allows downstream systems to identify:

- exact workflow used
- version lineage
- comparable outputs across institutions
- trusted registry source
- Federated Discovery Model

Each institution may expose only metadata.

Federation index searches:
- workflow TRS ID
- disease area
- model type
- output schema
- version

Actual sensitive data remains local.