# GlowEr Booking & Portfolio Bot — Bot specification

**Archetype:** booking

**Voice:** professional and warm — write every user-facing message, button label, error, and empty state in this voice.

Telegram bot for beauty studio GlowEr enabling service browsing, portfolio viewing, appointment booking, review management, and admin controls. Users can book appointments, view photos, and submit reviews. Staff receive booking notifications in a group chat. Admins manage services, portfolio, and reviews via bot interface.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- beauty clients
- studio staff
- administrators

## Success criteria

- 100+ monthly bookings tracked
- 50+ reviews submitted quarterly
- 95% staff notification delivery rate

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with service browsing, portfolio, and booking options
- **Browse Services** (button, actor: user, callback: services:list) — View available beauty treatments with booking options
- **View Portfolio** (button, actor: user, callback: portfolio:list) — Browse photo gallery by service categories
- **Leave Review** (button, actor: user, callback: reviews:submit) — Submit review with rating and photos (post-appointment only)
- **/admin** (command, actor: admin, command: /admin) — Open admin menu for service/portfolio management and review responses
- **My Bookings** (button, actor: user, callback: bookings:history) — View past and scheduled appointments

## Flows

### Booking Flow
_Trigger:_ services:book

1. Select service from list
2. Choose date (30-day calendar)
3. Pick time slot (15-min increments)
4. Confirm booking details
5. Collect phone number (optional contact sharing)
6. Send confirmation to user
7. Post notification to staff group chat

_Data touched:_ booking, user, service

### Post-Appointment Review
_Trigger:_ booking:completed

1. Schedule 1-hour post-appointment reminder
2. Send review prompt with rating stars and photo upload
3. Validate user has completed booking
4. Store review with optional photos
5. Notify admins of new review (configurable)

_Data touched:_ review, booking, user

### Admin Portfolio Management
_Trigger:_ /admin

1. Authenticate admin via configured Telegram ID
2. Upload photos with caption/tags
3. Assign to service categories
4. Delete or edit existing portfolio items

_Data touched:_ portfolio_item, service

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user** _(retention: persistent)_ — Telegram user profile with booking history
  - fields: telegram_id, name, phone, booking_history
- **service** _(retention: persistent)_ — Beauty treatment offering with scheduling parameters
  - fields: title, description, duration, price, photos, staff_assignee
- **portfolio_item** _(retention: persistent)_ — Studio photo gallery entry
  - fields: photos, caption, tags, service_category
- **review** _(retention: persistent)_ — Client feedback with optional media
  - fields: rating, text, photos, booking_reference, admin_reply
- **booking** _(retention: persistent)_ — Appointment record with status tracking
  - fields: service_id, user_id, datetime, duration, status, notes

## Integrations

- **Telegram** (required) — Bot API messaging and group notifications
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure admin Telegram IDs
- Set staff notification group chat ID
- Adjust service availability hours
- Manage portfolio categories
- Enable/disable public reviews

## Notifications

- Booking confirmation to user
- Staff group chat alerts for new bookings
- Post-appointment review prompts
- Admin review response notifications

## Permissions & privacy

- Collect phone numbers with user consent
- Store review photos securely
- Only admins can modify services/portfolio
- Review replies visible to all users

## Edge cases

- No available time slots for requested date
- User cancels mid-booking flow
- Multiple admins modifying services simultaneously
- Large photo uploads failing
- Time zone mismatches between user and studio

## Required tests

- End-to-end booking flow with calendar navigation
- Review submission with photo upload validation
- Admin portfolio management permissions
- Staff group notification formatting
- Post-appointment review eligibility checks

## Assumptions

- Studio operates 9:00-18:00 Mon-Sat by default
- Admins pre-configured via Telegram IDs
- Time zone set to studio location
- Photo uploads under 10MB per file
