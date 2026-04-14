# ga4gh-fedml-hackathon-connect2026

## Federated ML Hackathon - Connect 2026

This repository hosts resources and challenge areas for the Federated Machine Learning (ML) Hackathon organized by GA4GH at Connect 2026. The hackathon focuses on addressing key technical and organizational challenges in building secure, scalable, and interoperable federated systems for biomedical research and healthcare.

## Challenge Areas

Explore the following challenge areas to understand key problems and participate in solving them:

### 1. [Access to Data and Compute Resources](./01-access-data-compute/README.md)

Enabling secure and efficient access to distributed data and compute resources across federated environments. Topics include authentication/authorization passthrough, write-back mechanisms, workflow engine plugins, and token handling for federated compute access.

### 2. [Billing and Cost Accounting](./02-billing-cost-accounting/README.md)

Managing costs and financial accounting in federated environments that span multiple institutions and cloud providers. Focuses on tracking and distributing WES/TES compute costs and handling data egress costs in distributed environments.

### 3. [Telemetry and Service Information](./03-telemetry-service-info/README.md)

Collecting, aggregating, and exposing service metadata and telemetry information across federated systems. Covers compute resource discovery, infrastructure capability exposure through service-info APIs, and applying RO-crate standards to workflow engines.

### 4. [Policy Implementation](./04-policy-implementation/README.md)

Defining and enforcing policies for data access, governance, and compliance in federated environments. Includes policy framework implementation and developing templates/guidelines to help organizations establish federated collaborations.

### 5. [Real World Implementation](./05-real-world-implementation/README.md)

Demonstrating practical integration of solutions across all challenge areas in real federated computing scenarios. Primary focus: Connecting local laptops and compute networks to the APPFL TES network for end-to-end federated ML execution.

## About the Hackathon

This hackathon brings together developers, architects, and domain experts to address real-world challenges in federated systems. Participants will:

- Build practical solutions to federation challenges
- Work with GA4GH standards and specifications
- Collaborate across institutions and projects
- Contribute to open-source tools and frameworks
- Present and demonstrate their solutions


## Contributing

### Creating Issues

- Use GitHub Issues to report bugs, request features, or discuss ideas.
- Provide a clear and descriptive title.
- Include detailed description, steps to reproduce (for bugs), expected vs actual behavior.
- Assign appropriate labels and assign to yourself if you're working on it.

### Branch Naming

- Use descriptive branch names linked to issues: `feature/issue-123-description` or `bugfix/issue-456-fix`
- Prefix with `feature/`, `bugfix/`, `docs/`, etc.
- Keep names lowercase with hyphens.


### Folder Structure

- Stick to your assigned challenge folder (e.g., `01-access-data-compute/`) for all changes.
- Do not modify files outside your challenge area unless explicitly coordinated.
- Create subfolders as needed within your challenge directory.

### Pull Requests

- Create PRs from your feature branch to main or your challenge branch.
- Reference the issue number in the PR description.
- Ensure any CI passes and code is reviewed.

### AI Coding Agents

- AI coding assistants (like GitHub Copilot, Claude, etc.) are encouraged for accelerating development and exploring solutions
- All code changes must undergo human review before merging
- PRs that are primarily AI-generated should be clearly marked in the description

### Testing

- Include appropriate tests for new functionality (unit tests, integration tests, etc.)
- Test your changes in the relevant challenge environment before submitting
- Ensure all tests pass and consider edge cases
- Document any manual testing steps if automated tests are not feasible

## License

This project is licensed under the Apache License - see the [LICENSE](./LICENSE) file for details.


