# QM Portfolio --- Project Blueprint

## 1. Project Overview

QM Portfolio is a smart AI-powered student and professional portfolio platform. It enables users to present their education, skills, projects, certificates, resume, and professional links through a shareable public portfolio.

The platform supports public self-registration with email verification. Public signup always creates a regular user; privileged accounts are created only through the one-time initial-superadmin seed and future authorized administration workflows. This scope was approved for the Phase 2 backend implementation.

## 2. Goals

- Provide each user with a professional, shareable portfolio.
- Allow users to maintain education, skills, projects, certificates, and profile details.
- Support links to GitHub, LinkedIn, and YouTube.
- Support PDF and image uploads where appropriate.
- Provide multilingual user-facing content.
- Add portfolio-building and AI assistance features in later releases.

## 3. Proposed Technology

- Frontend: React
- Backend: Node.js and Express
- Database: MongoDB with Mongoose
- Authentication: Verified public registration, secure login, server-side sessions, and a one-time superadmin bootstrap
- File handling: PDF/image upload
- AI: Optional service for later-release suggestions

The repository's actual dependencies and implementation must be checked before treating this proposal as the implemented stack.

## 4. User Roles

### Administrator

- Sign in to the admin area.
- Create user accounts.
- Assign automatically generated R1 user IDs and initial passwords.
- View and manage user accounts.

### Portfolio User

- Sign in using administrator-provided credentials.
- Maintain profile and education information.
- Add and manage projects.
- Add GitHub, LinkedIn, and YouTube links.
- Upload permitted PDF and image files.
- Preview and share a public portfolio.

## 5. Functional Scope by Release

### Release 1 --- Core Platform

- Admin login.
- Public user registration with email verification; signup cannot assign roles.
- Authorized administrator account provisioning remains a planned workflow and uses generated R1 user IDs and initial credentials.
- One-time initial superadmin bootstrap from environment-provided credentials.
- User dashboard.
- Profile and education management.
- Ability to add multiple projects.
- GitHub, LinkedIn, and YouTube links.
- PDF and image uploads.
- Public portfolio page.
- Three-language interface support.

### Release 2 --- Portfolio Enhancements

- Portfolio score.
- QR code for portfolio sharing.
- Resume builder.
- Portfolio timeline.
- Visitor analytics.
- Certificate verification.
- Additional portfolio themes.

### Release 3 --- AI and Collaboration

- AI resume suggestions.
- AI project-description suggestions.
- Team collaboration.
- Visitor feedback.
- Admin reports.
- PDF export.

## 6. High-Level Architecture

1. React frontend presents public pages, login screens, admin tools, and user dashboards.
2. Express backend exposes API endpoints and enforces authentication and authorization.
3. MongoDB stores users, profile information, education, projects, and related metadata.
4. Upload handling stores files using the configured storage provider and saves file references.
5. Optional AI capabilities are introduced only when their service and integration are implemented.

## 7. Security and Quality Requirements

- Hash passwords; never store plaintext passwords.
- Protect private routes and API endpoints.
- Enforce admin-only account creation on the server, not only in the UI.
- Validate and sanitize incoming data.
- Validate upload type and size.
- Keep secrets in environment variables; do not commit `.env`.
- Avoid exposing private user information on public portfolio pages.
- Provide clear loading, empty, success, and error states.
- Make the interface responsive and accessible.

## 8. Core Data Areas

The implementation may use separate collections or an equivalent schema for users and roles, profiles, education, projects, uploaded assets, certificates, visitor analytics (later release), and feedback (later release). Exact schemas must follow the existing repository conventions after inspection.

## 9. Acceptance Criteria

- Users can register, verify email, sign in, and manage their own permitted portfolio data.
- Public signup cannot assign privileged roles; superadmin bootstrap refuses repeat seeding.
- Generated user IDs are unique for administrator-provisioned accounts.
- Users can sign in and manage their own permitted portfolio data.
- Public portfolio pages expose only intended public fields.
- Project, link, and upload workflows validate input and report errors.
- Release 1 language support is usable across the relevant interface.
- Protected APIs reject unauthenticated or unauthorized requests.

## 10. Scope and Change Control

This blueprint records intended scope, not proof of implementation. Before changing code, inspect the existing repository and compare it with this document. Preserve working conventions and document any necessary scope changes in `IMPLEMENTATION_STATUS.md`.
