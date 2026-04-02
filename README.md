# Tour Management System

A full-stack microservices application for managing travel tours, customer bookings, user access, and email notifications.

The platform is composed of:
- A React + TypeScript frontend
- Spring Boot backend microservices
- A Spring Cloud API gateway
- MySQL databases (one schema per service domain)

---

## 1) High-Level Architecture

### Services and ports
- **API Gateway**: `http://localhost:8080`
- **Auth Service**: `http://localhost:8081`
- **Tour Service**: `http://localhost:8082`
- **Booking Service**: `http://localhost:8083`
- **Notification Service**: `http://localhost:8084`
- **Frontend (Vite dev server)**: `http://localhost:5173`

### Request flow
1. Frontend sends API calls to the **API Gateway**.
2. Gateway validates JWT on protected routes and routes traffic by path.
3. Downstream services execute domain logic:
   - auth and users
   - tours and schedules
   - bookings, payments, invoices
   - notifications and invoice PDFs
4. Services persist data in their own MySQL schemas.

### Service data boundaries
- `tour_auth_db`
- `tour_service_db`
- `tour_booking_db`
- `tour_notification_db`

---

## 2) Repository Structure

```text
Tour-Management-System/
  api-gateway/           # Spring Cloud Gateway + JWT filter
  auth-service/          # Authentication, users, roles, password reset
  tour-service/          # Destinations, tour packages, schedules, seat availability
  booking-service/       # Booking lifecycle, payments, invoices, booking admin operations
  notification-service/  # Email delivery, HTML templates, PDF invoice generation
  frontend/              # React + TypeScript + Vite client app
  database-scripts/      # MySQL setup (DB creation, schema, seed data)
  start-backend.sh       # macOS terminal automation for backend startup
  .gitignore
```

> Note: A `docs/` folder is not currently present in this repository.

---

## 3) Tech Stack

### Backend
- Java 17
- Spring Boot 3.3.5
- Spring Data JPA (Hibernate)
- Spring Validation
- Spring Cloud Gateway (gateway only)
- Spring Security (auth-service)
- JJWT (JWT generation/validation)
- JavaMailSender (notification-service)
- OpenPDF (invoice/refund PDF generation)
- Maven

### Frontend
- React 18
- TypeScript
- Vite
- React Router v6
- Axios
- Tailwind CSS v4
- Subframe UI (`@subframe/core`)
- `react-day-picker`

### Database
- MySQL

---

## 4) Core Functional Areas

### Authentication and users
- User registration and login
- JWT token generation
- Profile update and password change (`/users/me`)
- User management for admin/staff roles
- Password reset by email passcode:
  - send code
  - verify code
  - reset password

### Tour management
- Destination CRUD
- Tour package CRUD
- Schedule CRUD
- Seat availability updates (reduce/increase)
- Tour filtering by destination, price, duration, status

### Booking and finance
- Customer booking creation
- Admin booking creation/update/cancellation/completion
- Traveler details per booking
- Payment records (mock payment flow)
- Invoice and refund invoice records
- Auto status reconciliation to `COMPLETED` based on schedule end date

### Notifications
- Generic email endpoint
- Booking confirmation emails with PDF invoice
- Cancellation confirmation emails with refund PDF
- Booking update emails
- Password reset code emails
- Email send logging to DB (with fallback status if SMTP is unavailable)

---

## 5) API Gateway Routing and Security

Gateway routes:
- `/auth/**`, `/users/**` -> auth-service
- `/destinations/**`, `/tours/**`, `/schedules/**` -> tour-service
- `/bookings/**`, `/admin/bookings/**`, `/payments/**`, `/invoices/**` -> booking-service
- `/notifications/**` -> notification-service

JWT behavior:
- Public paths include:
  - `/auth/login`
  - `/auth/register`
  - `/auth/forgot-password/*`
- Other routes require `Authorization: Bearer <token>`
- Gateway injects:
  - `X-User-Email`
  - `X-User-Id`
  - `X-User-Roles`

CORS allows localhost origins for local development.

---

## 6) Database Setup

### Option A: Run scripts manually
1. Execute `database-scripts/01-create-databases.sql`
2. Execute `database-scripts/02-schema-and-seed.sql`

### Option B: Run helper script
```bash
cd database-scripts
./run-all.sh
```

Optional environment overrides for script:
- `MYSQL_HOST` (default: `localhost`)
- `MYSQL_PORT` (default: `3306`)
- `MYSQL_USER` (default: `root`)
- `MYSQL_PASSWORD` (default: `1234`)

Seed highlights:
- Roles are seeded (`ADMIN`, `TRAVEL_MANAGER`, `STAFF`, `CUSTOMER`)
- Default admin user is inserted if missing
- Sample destination and tour package are inserted if missing

---

## 7) Local Development Setup

## Prerequisites
- Java 17
- Maven
- Node.js + npm
- MySQL server running locally

### Step 1: Configure service DB credentials (if needed)
By default, service `application.yml` files use:
- MySQL host: `localhost`
- user: `root`
- password: `1234`

Update credentials in:
- `auth-service/src/main/resources/application.yml`
- `tour-service/src/main/resources/application.yml`
- `booking-service/src/main/resources/application.yml`
- `notification-service/src/main/resources/application.yml`

### Step 2: Start backend services
Start each service in a separate terminal:

```bash
cd api-gateway && mvn spring-boot:run
cd auth-service && mvn spring-boot:run
cd tour-service && mvn spring-boot:run
cd booking-service && mvn spring-boot:run
cd notification-service && mvn spring-boot:run
```

Recommended order:
1. `api-gateway`
2. `auth-service`
3. `tour-service`
4. `booking-service`
5. `notification-service`

### Optional startup helper
```bash
./start-backend.sh
```

This script is macOS/Cursor-specific and opens separate Cursor terminals, then runs `mvn spring-boot:run` in each service folder.

### Step 3: Start frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## 8) Frontend Routes

Public:
- `/auth`

Authenticated:
- `/explore`
- `/explore/tours/:id`
- `/my-bookings`

Admin roles only (`ADMIN`, `TRAVEL_MANAGER`, `STAFF`):
- `/admin`
- `/admin/bookings`

---

## 9) Main Backend Endpoints

### Auth service
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password/send-code`
- `POST /auth/forgot-password/verify-code`
- `POST /auth/forgot-password/reset`
- `GET /users/me`
- `PUT /users/me`
- `PUT /users/me/password`
- `GET /users`
- `GET /users/{id}`
- `POST /users`
- `PUT /users/{id}`
- `PUT /users/{id}/roles`
- `DELETE /users/{id}`

### Tour service
- `GET /destinations`
- `POST /destinations`
- `PUT /destinations/{id}`
- `DELETE /destinations/{id}`
- `GET /tours`
- `GET /tours/{id}`
- `POST /tours`
- `PUT /tours/{id}`
- `DELETE /tours/{id}`
- `GET /schedules`
- `GET /schedules/{id}`
- `POST /schedules`
- `PUT /schedules/{id}`
- `DELETE /schedules/{id}`
- `PUT /tours/{id}/bookings/reduce`
- `PUT /tours/{id}/bookings/increase`

### Booking service
- `POST /bookings`
- `PUT /bookings/{id}`
- `GET /bookings/my?userId={id}`
- `GET /bookings`
- `PUT /bookings/{id}/cancel`
- `POST /admin/bookings`
- `PUT /admin/bookings/{id}`
- `POST /admin/bookings/search`
- `PUT /admin/bookings/{id}/cancel`
- `PUT /admin/bookings/{id}/complete`
- `GET /payments/{bookingId}`
- `GET /invoices/{bookingId}`
- `GET /invoices/{bookingId}/all`

### Notification service
- `POST /notifications/email`
- `POST /notifications/booking-confirmation`
- `POST /notifications/password-reset-code`
- `POST /notifications/cancellation-confirmation`
- `POST /notifications/booking-updated`
- `POST /notifications/invoice/pdf`
- `POST /notifications/refund-invoice/pdf`

---

## 10) SMTP / Email Notes

Notification service supports SMTP configuration via:
- `MAIL_HOST` (default: `smtp.gmail.com`)
- `MAIL_PORT` (default: `587`)
- `MAIL_USERNAME`
- `MAIL_PASSWORD`

Local override file:
- `notification-service/src/main/resources/application-local.yml`

For secure usage:
- Keep credentials out of version control
- Prefer environment variables for local/prod

---

## 11) Current Known Gaps / Non-Production Defaults

- Service-level authorization is minimal outside gateway
- No distributed transaction/saga for cross-service booking operations
- `ddl-auto: update` used in services (fine for local dev, risky for production schema governance)
- No Docker/Kubernetes manifests in repository
- No automated tests currently present under `src/test`

---

## 12) Troubleshooting

### Frontend cannot reach backend
- Confirm API gateway is up on `8080`
- Confirm frontend points to `http://localhost:8080` (see `frontend/src/lib/api.ts`)

### Login works but route access fails
- Inspect JWT payload roles
- Verify role checks in gateway filter

### Booking creation fails
- Ensure:
  - tour-service is running
  - notification-service is running (or email fallback still logs)
  - selected tour has enough `bookingsAvailable`

### Emails not sent
- Verify SMTP credentials/profile in notification-service
- Check `tour_notification_db.email_logs` for send status (`SENT` vs `LOGGED`)

---

## 13) License / Usage

This project is licensed under the **MIT License**.

Copyright (c) 2026 **Karthik Kavuri**

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, subject to the conditions of the MIT License.
