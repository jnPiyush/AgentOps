# PRD: Task Tracker for Small Teams

**Epic**: #1
**Status**: Draft
**Author**: Product Manager Agent
**Date**: 2026-04-17
**Stakeholders**: Engineering Lead, Design Lead, Product Owner
**Priority**: p1

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Target Users](#2-target-users)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Research Summary](#research-summary)
5. [Requirements](#4-requirements)
6. [User Stories & Features](#5-user-stories--features)
7. [User Flows](#6-user-flows)
8. [Dependencies & Constraints](#7-dependencies--constraints)
9. [Risks & Mitigations](#8-risks--mitigations)
10. [Timeline & Milestones](#9-timeline--milestones)
11. [Out of Scope](#10-out-of-scope)
12. [Open Questions](#11-open-questions)
13. [Appendix](#12-appendix)

---

## 1. Problem Statement

### What problem are we solving?

Small teams (2-15 people) struggle to track who owns what, when things are due, and what is overdue. They resort to spreadsheets, sticky notes, or chat messages -- all of which lose context and provide no overdue visibility. Existing tools like Asana, monday.com, and ClickUp are powerful but overwhelming for small teams that need simplicity over features.

### Why is this important?

Missed deadlines cost small teams credibility, revenue, and morale. A lightweight task tracker with a dedicated overdue dashboard directly reduces forgotten work and improves accountability without adding process overhead.

### What happens if we don't solve this?

Teams continue relying on ad-hoc tracking methods. Overdue work goes unnoticed until someone asks. Accountability is unclear. As teams grow, the problem compounds and migration to heavier tools becomes painful.

---

## 2. Target Users

### Primary Users

**User Persona 1: Team Lead / Manager**
- **Demographics**: 25-45, tech-comfortable, manages 3-12 direct reports
- **Goals**: See what is overdue at a glance, assign work with deadlines, hold the team accountable
- **Pain Points**: No single view of overdue items, spreadsheets get stale, chat-based task assignment loses context
- **Behaviors**: Currently uses Google Sheets or Trello free tier, checks tasks manually each morning

**User Persona 2: Team Member / Individual Contributor**
- **Demographics**: 22-40, comfortable with web apps, works on 5-20 tasks at a time
- **Goals**: Know what to work on next, never miss a deadline, update task status quickly
- **Pain Points**: Tasks assigned via Slack/email get buried, no reminders for due dates, unclear priorities
- **Behaviors**: Checks email and chat first thing, prefers minimal-click workflows

### Secondary Users

- **Executives / Stakeholders**: View-only access to the overdue dashboard for status visibility without needing to log in daily.

---

## 3. Goals & Success Metrics

### Business Goals

1. **Reduce missed deadlines**: Teams using the app should miss fewer due dates within the first month of adoption.
2. **Fast onboarding**: A new user should create their first task within 2 minutes of signing up.
3. **Team adoption**: At least 80% of invited team members should log in within the first week.

### Success Metrics (KPIs)

| Metric | Current (no tool) | Target | Timeline |
|--------|-------------------|--------|----------|
| Overdue tasks discovered same-day | ~30% | 90%+ | 4 weeks post-launch |
| Time to create first task | N/A | < 2 minutes | Launch |
| Weekly active users (of invited) | N/A | > 80% | 4 weeks post-launch |
| Task completion rate (on time) | Unknown | > 75% | 8 weeks post-launch |

### User Success Criteria

- Team leads can identify all overdue work in under 10 seconds from the dashboard.
- Team members receive clear, actionable due-date reminders before tasks go overdue.
- New users can sign up with email and create a task without reading documentation.

---

## Research Summary

### Sources Consulted

| Source | URL | Key Takeaway |
|--------|-----|--------------|
| G2 Task Management Category | https://www.g2.com/categories/task-management | 459+ tools listed; simplicity and deadline tracking are the standout features users value most |
| Wikipedia: Comparison of PM Software | https://en.wikipedia.org/wiki/Comparison_of_project_management_software | Comprehensive feature matrix across 100+ tools; task assignment, email notifications, and dashboards are table-stakes |
| G2 User Sentiment (Asana) | G2 review data | Users praise flexibility but complain about clutter when handling multiple projects |
| G2 User Sentiment (ClickUp) | G2 review data | Rated 4.7/5 by small businesses but described as "overwhelming due to many features" |
| G2 User Sentiment (Trello) | G2 review data | Loved for drag-and-drop simplicity; criticized for lacking advanced reporting and overdue views |
| G2 User Sentiment (Todoist) | G2 review data | 4.5/5 for individual task management; trusted by 50M+ users for its simplicity |
| G2 User Sentiment (Microsoft Planner) | G2 review data | Enterprise-focused (38% enterprise segment); small teams find it tied to M365 ecosystem |

### Competitive Analysis (Comparison Matrix)

| Feature | Asana | Trello | Todoist | ClickUp | monday.com | **Our App** |
|---------|-------|--------|---------|---------|------------|-------------|
| Free tier | Yes | Yes | Yes | Yes | Yes | Yes (planned) |
| Email login | Yes | Yes | Yes | Yes | Yes | **Yes (P0)** |
| Task CRUD | Yes | Yes | Yes | Yes | Yes | **Yes (P0)** |
| Due dates | Yes | Yes (power-up) | Yes | Yes | Yes | **Yes (P0)** |
| Overdue dashboard | Partial (filter) | No (manual) | Partial (filter) | Yes (view) | Yes (widget) | **Yes (P0, dedicated)** |
| Simplicity (G2 ease-of-use) | Medium | High | High | Low | Medium | **High (target)** |
| Setup time | Minutes | Seconds | Seconds | 10+ min | 5+ min | **< 2 min (target)** |
| Small-team focus | No (scales to enterprise) | Partial | Individual-first | No (feature-heavy) | No (feature-heavy) | **Yes (core focus)** |

### Key Findings

1. **Simplicity is the top differentiator for small teams.** G2 data shows users of Trello (4.4/5), Todoist (4.5/5), and Backlog (4.6/5) consistently praise ease of use. Feature-rich tools (ClickUp, Wrike) get complaints about complexity.
2. **Overdue visibility is an underserved need.** No major tool offers a first-class "overdue dashboard" as a primary view. Users must create custom filters or reports. This is our differentiation opportunity.
3. **Email notifications for overdue tasks are a proven pattern.** G2 identifies email notifications as a core capability of the category, with "reminders at the beginning of each day which tasks have a high priority" being a key feature.
4. **77% of ClickUp users are small-business.** The small-team segment is the largest buyer segment across task management tools, but most tools grow toward enterprise features, leaving small teams underserved.
5. **Email login is standard.** Every competitor supports email-based authentication. Social login (Google, Microsoft) is common but not required for MVP.

### Chosen Approach Rationale

Build a laser-focused task tracker for small teams with:
- **Email login only** (simplest auth, no OAuth complexity for MVP)
- **Task CRUD with due dates** as the core loop
- **Dedicated overdue dashboard** as the default landing page for team leads
- **Minimal UI** -- no Gantt charts, no time tracking, no resource management

### Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| Build a full project management suite | Feature bloat is the #1 complaint about existing tools. Small teams abandon complex tools. |
| Use OAuth/social login for MVP | Adds OAuth provider integration complexity. Email + password is sufficient for MVP and simpler to implement. |
| Kanban board as primary view | Kanban does not surface overdue work prominently. A dedicated overdue dashboard is our differentiator. |
| Mobile-first approach | Small teams primarily work on desktop/laptop. Responsive web is sufficient for MVP. |

---

## 4. Requirements

### 4.1 Functional Requirements

#### Must Have (P0)

1. **Email Authentication**
   - **User Story**: As a user, I want to sign up and log in with my email and password so that I can access my team's tasks securely.
   - **Acceptance Criteria**:
     - [ ] User can register with email + password
     - [ ] User can log in with email + password
     - [ ] Password is hashed (bcrypt/argon2) and never stored in plaintext
     - [ ] Email verification is sent on registration
     - [ ] Session persists via secure HTTP-only cookie or JWT
     - [ ] User can reset password via email link

2. **Task CRUD**
   - **User Story**: As a team member, I want to create, view, edit, and delete tasks so that I can manage my work.
   - **Acceptance Criteria**:
     - [ ] User can create a task with title (required), description (optional), due date (optional), and assignee (optional)
     - [ ] User can view a list of all tasks for their team
     - [ ] User can edit any field of an existing task
     - [ ] User can delete a task (soft delete)
     - [ ] User can mark a task as complete
     - [ ] Tasks have statuses: To Do, In Progress, Done

3. **Due Dates**
   - **User Story**: As a team member, I want to set due dates on tasks so that deadlines are explicit and trackable.
   - **Acceptance Criteria**:
     - [ ] Date picker for selecting due date on task create/edit
     - [ ] Due date displayed on task list and task detail views
     - [ ] Overdue tasks visually highlighted (red/warning styling)
     - [ ] Tasks sortable by due date

4. **Overdue Dashboard**
   - **User Story**: As a team lead, I want a dashboard that shows all overdue tasks so that I can immediately see what needs attention.
   - **Acceptance Criteria**:
     - [ ] Dashboard is the default landing page after login
     - [ ] Shows all tasks where due date < today and status != Done
     - [ ] Grouped by assignee
     - [ ] Shows days overdue count for each task
     - [ ] Shows total overdue count prominently
     - [ ] Filterable by assignee
     - [ ] Refreshes on page load (no manual refresh needed)

5. **Team Management (Basic)**
   - **User Story**: As a team lead, I want to invite team members by email so they can join my workspace.
   - **Acceptance Criteria**:
     - [ ] Team lead can invite users by email address
     - [ ] Invited user receives email with signup/join link
     - [ ] Users belong to exactly one team (MVP)
     - [ ] Team members can see all tasks in their team

#### Should Have (P1)

1. **Email Reminders for Due Dates**
   - **User Story**: As a team member, I want to receive an email reminder when a task is due tomorrow so that I do not miss deadlines.
   - **Acceptance Criteria**:
     - [ ] Daily email sent at 8 AM (team timezone) listing tasks due today and tomorrow
     - [ ] Email lists overdue tasks (if any)
     - [ ] User can opt out of reminders in settings

2. **Task Filtering and Search**
   - **User Story**: As a team member, I want to filter tasks by status, assignee, and due date range so that I can find specific tasks quickly.
   - **Acceptance Criteria**:
     - [ ] Filter by status (To Do, In Progress, Done)
     - [ ] Filter by assignee
     - [ ] Filter by due date range
     - [ ] Text search across task title and description

3. **Task Comments**
   - **User Story**: As a team member, I want to add comments to a task so that discussions stay attached to the relevant work.
   - **Acceptance Criteria**:
     - [ ] Users can add text comments to any task
     - [ ] Comments show author and timestamp
     - [ ] Comments are ordered chronologically

#### Could Have (P2)

1. **Task Priority Levels**
   - **User Story**: As a team lead, I want to set priority levels (High, Medium, Low) on tasks so the team knows what to focus on first.

2. **Activity Log**
   - **User Story**: As a team lead, I want to see a log of task changes (created, edited, completed) so I have an audit trail.

3. **CSV Export**
   - **User Story**: As a team lead, I want to export tasks to CSV so I can share status with stakeholders who do not have accounts.

#### Won't Have (Out of Scope for MVP)

- Gantt charts or timeline views
- Time tracking
- Subtasks or task dependencies
- File attachments
- Recurring tasks
- Mobile native apps (responsive web only)
- OAuth / social login (email only for MVP)
- Multiple teams per user
- Role-based permissions beyond team lead vs member

### 4.2 AI/ML Requirements

#### Technology Classification

- [x] **Rule-based / statistical** -- no model needed (deterministic logic only)

> This application is a straightforward CRUD + dashboard app. No AI/ML capabilities are needed for the MVP.

### 4.3 Non-Functional Requirements

#### Performance

- **Response Time**: Page load < 2 seconds; API responses < 500ms (p95)
- **Throughput**: Handle 50 concurrent users per team instance
- **Uptime**: 99.5% availability (allows ~44 hours downtime/year)

#### Security

- **Authentication**: Email + password with bcrypt/argon2 hashing
- **Session Management**: HTTP-only secure cookies or JWT with short expiry + refresh token
- **Data Protection**: HTTPS (TLS 1.2+) in transit; encryption at rest for database
- **Compliance**: GDPR-aware (user data deletion on request)
- **Input Validation**: All user inputs validated and sanitized server-side
- **Rate Limiting**: Login endpoint rate-limited to prevent brute force

#### Scalability

- **Concurrent Users**: Support up to 500 users across all teams at MVP
- **Data Volume**: Handle up to 10,000 tasks per team
- **Growth**: Architecture should allow horizontal scaling (stateless API)

#### Usability

- **Accessibility**: WCAG 2.1 AA compliance for core flows (login, task CRUD, dashboard)
- **Browser Support**: Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Mobile**: Responsive design -- usable on tablet and mobile browsers
- **Localization**: English only for MVP

#### Reliability

- **Error Handling**: User-friendly error messages; no stack traces exposed
- **Recovery**: Automatic retry on transient database connection failures
- **Monitoring**: Health check endpoint; structured logging for errors

---

## 5. User Stories & Features

### Feature 1: Email Authentication

**Description**: Secure email-based signup, login, password reset, and email verification.
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-1.1 | new user | to register with my email and password | I can access the app | - [ ] Registration form with email + password<br>- [ ] Password strength validation (8+ chars)<br>- [ ] Email verification sent | P0 | 3 days |
| US-1.2 | registered user | to log in with my email and password | I can access my tasks | - [ ] Login form with email + password<br>- [ ] Session created on success<br>- [ ] Error message on invalid credentials | P0 | 2 days |
| US-1.3 | user | to reset my password via email | I can recover my account if I forget my password | - [ ] "Forgot password" link on login page<br>- [ ] Reset email with time-limited token<br>- [ ] New password form | P0 | 2 days |

### Feature 2: Task CRUD

**Description**: Create, read, update, and delete tasks with title, description, due date, assignee, and status.
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-2.1 | team member | to create a task with title, description, due date, and assignee | work is captured and assigned | - [ ] Task form with required title<br>- [ ] Optional description, due date, assignee<br>- [ ] Task saved to database | P0 | 3 days |
| US-2.2 | team member | to view all tasks for my team | I can see what everyone is working on | - [ ] Task list view with columns: title, assignee, due date, status<br>- [ ] Sortable by due date and status | P0 | 2 days |
| US-2.3 | team member | to edit a task | I can update details as work evolves | - [ ] All fields editable<br>- [ ] Changes saved immediately | P0 | 2 days |
| US-2.4 | team member | to mark a task as complete | completed work is tracked | - [ ] One-click "Complete" action<br>- [ ] Task moves to Done status<br>- [ ] Removed from overdue dashboard | P0 | 1 day |
| US-2.5 | team member | to delete a task | I can remove tasks created by mistake | - [ ] Delete action with confirmation<br>- [ ] Soft delete (recoverable) | P0 | 1 day |

### Feature 3: Overdue Dashboard

**Description**: Dedicated dashboard view showing all overdue tasks grouped by assignee, with days-overdue count.
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-3.1 | team lead | to see all overdue tasks on a dashboard | I immediately know what needs attention | - [ ] Default landing page after login<br>- [ ] Shows tasks where due_date < today AND status != Done<br>- [ ] Total overdue count displayed prominently | P0 | 3 days |
| US-3.2 | team lead | to see overdue tasks grouped by assignee | I can hold the right people accountable | - [ ] Tasks grouped under assignee name<br>- [ ] Count per assignee | P0 | 2 days |
| US-3.3 | team lead | to see how many days each task is overdue | I can prioritize the most urgent items | - [ ] "X days overdue" badge on each task<br>- [ ] Sorted by days overdue (most overdue first) | P0 | 1 day |
| US-3.4 | team lead | to filter the overdue dashboard by assignee | I can focus on one person at a time | - [ ] Assignee dropdown filter<br>- [ ] Dashboard updates without full page reload | P1 | 1 day |

### Feature 4: Team Management

**Description**: Invite team members by email; users belong to one team.
**Priority**: P0
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-4.1 | team lead | to create a team when I sign up | my workspace is ready for collaboration | - [ ] Team name input during signup<br>- [ ] Creator becomes team lead | P0 | 2 days |
| US-4.2 | team lead | to invite team members by email | they can join and see our tasks | - [ ] Invite form with email input<br>- [ ] Invitation email sent with join link<br>- [ ] Invited user auto-joins team on signup | P0 | 3 days |

### Feature 5: Email Reminders

**Description**: Daily email notifications for tasks due today, tomorrow, and overdue.
**Priority**: P1
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-5.1 | team member | to receive a daily email listing tasks due today and tomorrow | I never miss a deadline | - [ ] Email sent at 8 AM team timezone<br>- [ ] Lists due-today and due-tomorrow tasks<br>- [ ] Includes overdue tasks section | P1 | 3 days |
| US-5.2 | team member | to opt out of email reminders | I am not bothered if I do not want emails | - [ ] Toggle in user settings<br>- [ ] Default: reminders ON | P1 | 1 day |

### Feature 6: Task Filtering and Search

**Description**: Filter tasks by status, assignee, due date range; full-text search on title and description.
**Priority**: P1
**Epic**: #1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-6.1 | team member | to filter tasks by status, assignee, and due date | I can find specific tasks quickly | - [ ] Filter controls on task list view<br>- [ ] Combinable filters<br>- [ ] Filters applied client-side or via API query params | P1 | 2 days |
| US-6.2 | team member | to search tasks by keyword | I can find tasks by name or content | - [ ] Search input on task list<br>- [ ] Searches title and description<br>- [ ] Results update as I type (debounced) | P1 | 2 days |

---

## 6. User Flows

### Primary Flow: New User Signup and First Task

**Trigger**: User visits the app for the first time (via invite link or direct).
**Preconditions**: None.

**Steps**:
1. User clicks "Sign Up" and enters email + password (+ team name if creating new team)
2. System sends verification email
3. User clicks verification link in email
4. System activates account and redirects to overdue dashboard (empty state)
5. User clicks "New Task" button
6. System shows task creation form (title, description, due date, assignee)
7. User fills in title and due date, clicks "Create"
8. System saves task and shows it in the task list
9. **Success State**: User has an account, a team, and their first task created

**Alternative Flows**:
- **3a. User does not verify email within 24h**: System sends a reminder email. Account remains inactive.
- **7a. Title is empty**: System shows inline validation error "Title is required."

### Secondary Flow: Team Lead Reviews Overdue Dashboard

**Trigger**: Team lead logs in on a weekday morning.
**Preconditions**: Team has tasks with due dates, some of which are past due.

**Steps**:
1. Team lead logs in with email + password
2. System shows overdue dashboard (default landing page)
3. Dashboard displays overdue tasks grouped by assignee, sorted by days overdue
4. Team lead clicks an overdue task to view details
5. System shows task detail with full description, comments, and history
6. Team lead updates task status or reassigns it
7. **Success State**: Team lead has reviewed all overdue items and taken action

### Tertiary Flow: Task Completion

**Trigger**: Team member finishes work on a task.
**Preconditions**: Task exists in "In Progress" status.

**Steps**:
1. Team member navigates to task list or task detail
2. User clicks "Complete" button
3. System moves task to "Done" status
4. Task is removed from overdue dashboard
5. **Success State**: Task is marked complete, overdue count decremented

---

## 7. Dependencies & Constraints

### Technical Dependencies

| Dependency | Type | Status | Owner | Impact if Unavailable |
|------------|------|--------|-------|----------------------|
| Email delivery service (SendGrid, AWS SES, or similar) | External | Available | Engineering | High -- signup, invites, and reminders blocked |
| Relational database (PostgreSQL) | Infrastructure | Available | Engineering | High -- no data persistence |
| Hosting platform (cloud VM, PaaS, or container) | Infrastructure | Available | Engineering | High -- app not accessible |

### Business Dependencies

- None for MVP -- this is a greenfield product.

### Technical Constraints

- Must use a relational database (PostgreSQL preferred) for ACID compliance on task operations.
- Must send transactional emails (verification, invites, password reset) -- requires an email provider.
- Must be deployable as a single web application (API + static frontend).
- Must support HTTPS in production.

### Resource Constraints

- Development team: 2 engineers
- Timeline: 6 weeks (see milestones)
- Budget: Minimal -- use open-source stack and free-tier cloud services where possible

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| Email delivery failures (verification, invites) | High | Medium | Use established provider (SendGrid/SES); implement retry with exponential backoff; show "resend" option in UI | Engineer |
| Scope creep beyond MVP features | High | High | Strict P0/P1/P2 prioritization; defer all P2 items; weekly scope review | PM |
| Low team adoption after invite | Medium | Medium | Optimize invite flow; send follow-up reminders; make first-task creation frictionless | PM + Engineer |
| Performance degradation with large task lists | Medium | Low | Paginate task list API (50 per page); index due_date and team_id columns; lazy-load dashboard | Engineer |
| Security vulnerability in auth flow | High | Low | Use established auth libraries (passport.js / next-auth); bcrypt for passwords; security review before launch | Engineer |

---

## 9. Timeline & Milestones

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Backend API, database, and authentication ready.
**Deliverables**:
- Database schema (users, teams, tasks, invitations)
- Auth API (register, login, verify email, reset password)
- Task CRUD API endpoints
- Team creation and invite API
- Unit and integration tests for all endpoints

**Stories**: US-1.1, US-1.2, US-1.3, US-2.1, US-2.3, US-2.5, US-4.1

### Phase 2: Frontend Core (Weeks 3-4)

**Goal**: Task list, task forms, and overdue dashboard functional in the browser.
**Deliverables**:
- Login / signup / password reset pages
- Task list view with create, edit, delete, complete actions
- Overdue dashboard with grouping and days-overdue badges
- Team invite flow (send invite, accept invite)
- Responsive design for tablet/mobile

**Stories**: US-2.2, US-2.4, US-3.1, US-3.2, US-3.3, US-4.2

### Phase 3: Polish & P1 Features (Weeks 5-6)

**Goal**: Email reminders, filtering/search, UX polish, and production readiness.
**Deliverables**:
- Daily email reminder job (due today, tomorrow, overdue)
- Task filtering and search
- Dashboard assignee filter
- Error handling, loading states, empty states
- HTTPS, rate limiting, security hardening
- Production deployment

**Stories**: US-3.4, US-5.1, US-5.2, US-6.1, US-6.2

---

## 10. Out of Scope

- Gantt charts, Kanban boards, or timeline views
- Time tracking or effort estimation
- Subtasks or task dependencies
- File attachments on tasks
- Recurring / repeating tasks
- Native mobile apps (iOS/Android)
- OAuth / social login (Google, Microsoft, GitHub)
- Multiple teams per user
- Role-based permissions beyond team lead vs team member
- Integrations with Slack, email, calendar, or other tools
- Billing, payments, or subscription management
- AI-powered features (smart assignment, priority suggestions)

---

## 11. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should the overdue dashboard be the default page for ALL users or only team leads? | PM | Open -- leaning toward all users (simpler, promotes accountability) |
| 2 | What email provider should we use? (SendGrid free tier vs AWS SES vs Resend) | Engineer | Open |
| 3 | Should "team lead" be a distinct role with extra permissions, or should all members be equal in MVP? | PM | Open -- leaning toward equal permissions in MVP with a future "admin" role |
| 4 | What is the maximum team size we need to support for MVP? | PM | Proposed: 25 members per team |
| 5 | Do we need email notification when someone assigns you a task? | PM | Open -- P1 candidate if time allows |

---

## 12. Appendix

### Competitive Landscape Sources

- G2 Task Management Category: https://www.g2.com/categories/task-management (459+ tools, user sentiment data)
- Wikipedia Comparison of PM Software: https://en.wikipedia.org/wiki/Comparison_of_project_management_software (feature matrix)

### Technology Recommendations (for Architect)

These are product-level recommendations, not mandates -- Architect decides the final stack:
- **Frontend**: React or similar SPA framework (fast interactions, responsive)
- **Backend**: Node.js or Python (team familiarity, ecosystem)
- **Database**: PostgreSQL (relational, ACID, free tier on most clouds)
- **Email**: SendGrid (free tier: 100 emails/day) or Resend
- **Hosting**: Any PaaS with free/low-cost tier (Vercel, Railway, Render, Azure App Service)

### Glossary

| Term | Definition |
|------|-----------|
| Team | A workspace containing members and tasks. One team per user in MVP. |
| Team Lead | The user who created the team. May have admin capabilities in future. |
| Overdue Task | A task with due_date < today AND status != Done. |
| Soft Delete | Task is marked deleted but retained in database for recovery. |
