# LoopKit
Create. Share. Grow.

LoopKit is an English-language toolkit for community event organizers. The repository contains the Next.js application, Supabase migrations, browser utilities and release checks.

- [Current status](BUILD_STATUS.md)
- [Architecture](ARCHITECTURE.md)
- [Implementation milestones](BUILD_PLAN.md)
- [Verification report](TEST_REPORT.md)
- [Deployment and owner setup](DEPLOYMENT.md)
- [Security](SECURITY.md)
- [Launch strategy](LAUNCH_PLAN.md)

For development use Node 24, npm ci and npm run dev. The hosted GitHub Actions checks provide a browser-based way to run validation. Environment settings are listed in .env.example. LoopKit is a provisional brand pending clearance.

The [release review](RELEASE_REVIEW.md) lists the implemented routes, verified scope, external dependencies and remaining launch steps. Production browser evidence is in [qa](qa/). The **Verify hosted flows locally** GitHub Action runs disposable database and identity services on its runner. Its challenge and webhook fixtures are isolated from the application.
