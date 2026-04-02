package com.tour.notification.service;

import com.tour.notification.dto.NotificationDtos;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

@Service
public class EmailTemplateService {

    private static final DateTimeFormatter DISPLAY = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);

    // ── Public API ────────────────────────────────────────────────────────────

    public String bookingConfirmation(NotificationDtos.BookingConfirmationRequest r) {
        String name        = safe(r.customerName(), "Valued Customer");
        String ref         = safe(r.bookingReference(), "—");
        String inv         = safe(r.invoiceNumber(), "—");
        String tour        = safe(r.tourTitle(), "Your Tour");
        String dest        = safe(r.destinationName(), "—");
        String start       = fmtDate(r.travelStartDate());
        String end         = fmtDate(r.travelEndDate());
        String dur         = r.durationDays() != null ? r.durationDays() + " days" : "—";
        String travelers   = r.numberOfTravelers() != null ? r.numberOfTravelers() + (r.numberOfTravelers() == 1 ? " person" : " people") : "—";
        String total       = fmtMoney(r.totalAmount());
        String payment     = safe(r.paymentMethod(), "CREDIT_CARD").replace("_", " ");
        String bookingDate = safe(r.bookingDate(), "—");

        return TEMPLATE
            .replace("{{name}}", esc(name))
            .replace("{{booking_reference}}", esc(ref))
            .replace("{{invoice_number}}", esc(inv))
            .replace("{{tour_title}}", esc(tour))
            .replace("{{destination}}", esc(dest))
            .replace("{{start_date}}", esc(start))
            .replace("{{end_date}}", esc(end))
            .replace("{{duration}}", esc(dur))
            .replace("{{travelers}}", esc(travelers))
            .replace("{{total}}", esc(total))
            .replace("{{payment_method}}", esc(payment))
            .replace("{{booking_date}}", esc(bookingDate));
    }

    public String passwordResetCode(NotificationDtos.PasswordResetCodeRequest r) {
        String name = safe(r.customerName(), "Traveler");
        String code = safe(r.resetCode(), "------");
        String mins = String.valueOf(r.expiresInMinutes() == null ? 10 : r.expiresInMinutes());
        return PASSWORD_RESET_TEMPLATE
                .replace("{{name}}", esc(name))
                .replace("{{code}}", esc(code))
                .replace("{{expires}}", esc(mins));
    }

    public String bookingUpdated(NotificationDtos.BookingUpdatedRequest r) {
        String name       = safe(r.customerName(), "Valued Customer");
        String ref        = safe(r.bookingReference(), "—");
        String tour       = safe(r.tourTitle(), "Your Tour");
        String dest       = safe(r.destinationName(), "—");
        String start      = fmtDate(r.travelStartDate());
        String end        = fmtDate(r.travelEndDate());
        String dur        = deriveDurationLabel(r.durationDays(), r.travelStartDate(), r.travelEndDate());
        String travelers  = r.numberOfTravelers() != null ? r.numberOfTravelers() + (r.numberOfTravelers() == 1 ? " person" : " people") : "—";
        String total      = fmtMoney(r.totalAmount());
        String updatedAt  = safe(r.updatedAt(), fmtDate(null));
        return UPDATE_TEMPLATE
                .replace("{{name}}", esc(name))
                .replace("{{booking_reference}}", esc(ref))
                .replace("{{tour_title}}", esc(tour))
                .replace("{{destination}}", esc(dest))
                .replace("{{start_date}}", esc(start))
                .replace("{{end_date}}", esc(end))
                .replace("{{duration}}", esc(dur))
                .replace("{{travelers}}", esc(travelers))
                .replace("{{total}}", esc(total))
                .replace("{{updated_at}}", esc(updatedAt));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String safe(String v, String fallback) {
        return (v != null && !v.isBlank()) ? v : fallback;
    }

    private static String esc(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String fmtDate(String iso) {
        if (iso == null || iso.isBlank()) return "—";
        try { return LocalDate.parse(iso).format(DISPLAY); } catch (Exception e) { return iso; }
    }

    private static String fmtMoney(java.math.BigDecimal v) {
        if (v == null) return "—";
        return String.format("$%,.2f", v);
    }

    // ── HTML Template ─────────────────────────────────────────────────────────
    // Uses {{placeholder}} markers — no % signs to avoid String.format escaping issues.

    private static final String TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Booking Confirmed – Wanderlust Tours</title>
<style>
  body{margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}
  .wrap{width:100%;padding:32px 12px;background:#f0f4f8;box-sizing:border-box}
  .card{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.10)}
  /* Header */
  .hdr{background:linear-gradient(135deg,#1a56db 0%,#1e3a8a 100%);padding:36px 40px 28px;text-align:center}
  .hdr-logo{font-size:26px;font-weight:800;color:#fff;margin:0 0 4px;letter-spacing:-.3px}
  .hdr-tag{font-size:13px;color:rgba(255,255,255,.65);margin:0}
  /* Confirmed banner */
  .banner{background:#ecfdf5;border-bottom:1px solid #bbf7d0;padding:28px 40px 22px;text-align:center}
  .banner-circle{width:52px;height:52px;background:#10b981;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;font-size:22px;color:#fff;font-weight:700}
  .banner h2{margin:0 0 6px;color:#065f46;font-size:22px;font-weight:700}
  .banner p{margin:0;color:#047857;font-size:14px;line-height:1.5}
  /* Reference box */
  .ref-box{margin:24px 40px 0;padding:18px 24px;background:#eff6ff;border:2px dashed #93c5fd;border-radius:12px;text-align:center}
  .ref-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#6b7280;margin-bottom:6px}
  .ref-value{font-size:30px;font-weight:800;color:#1e40af;letter-spacing:3px}
  /* Body */
  .body{padding:28px 40px 36px}
  .greeting{font-size:15px;color:#374151;line-height:1.7;margin:0 0 28px}
  /* Section */
  .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid #f3f4f6}
  .sec{margin-bottom:26px}
  /* Detail grid */
  .dg{background:#f9fafb;border-radius:10px;overflow:hidden;border:1px solid #f3f4f6}
  .dr{display:flex;justify-content:space-between;align-items:center;padding:10px 18px;font-size:14px}
  .dr+.dr{border-top:1px solid #f3f4f6}
  .dl{color:#6b7280}
  .dv{color:#111827;font-weight:600;text-align:right}
  /* Payment grid */
  .pg{background:#f9fafb;border-radius:10px;overflow:hidden;border:1px solid #f3f4f6}
  .pr{display:flex;justify-content:space-between;padding:10px 18px;font-size:14px;color:#374151}
  .pr+.pr{border-top:1px solid #f3f4f6}
  .pr-total{background:#1a56db;padding:14px 18px}
  .pr-total .pl{color:#fff;font-weight:700;font-size:15px}
  .pr-total .pv{color:#fff;font-weight:800;font-size:18px}
  /* Attachment note */
  .att{background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px 18px;margin-top:6px;font-size:13px;color:#92400e;line-height:1.5}
  /* What's next */
  .next{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:18px 20px;margin-top:24px}
  .next-title{font-size:13px;font-weight:700;color:#0369a1;margin:0 0 10px}
  .next-item{font-size:13px;color:#374151;padding:4px 0;padding-left:18px;position:relative}
  .next-item:before{content:'→';position:absolute;left:0;color:#0369a1;font-weight:700}
  /* Footer */
  .ftr{background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center}
  .ftr-brand{font-size:13px;font-weight:700;color:#374151;margin:0 0 6px}
  .ftr p{font-size:12px;color:#9ca3af;margin:3px 0;line-height:1.6}
  .ftr-divider{height:1px;background:#e5e7eb;margin:12px 0}
</style>
</head>
<body>
<div class="wrap">
<div class="card">

  <!-- Header -->
  <div class="hdr">
    <p class="hdr-logo">&#9992; Wanderlust Tours</p>
    <p class="hdr-tag">Your journey begins here</p>
  </div>

  <!-- Confirmed Banner -->
  <div class="banner">
    <div class="banner-circle">&#10003;</div>
    <h2>Booking Confirmed!</h2>
    <p>Your tour has been booked and your payment has been processed successfully.</p>
  </div>

  <!-- Reference Box -->
  <div class="ref-box">
    <div class="ref-label">Booking Reference</div>
    <div class="ref-value">{{booking_reference}}</div>
  </div>

  <!-- Body -->
  <div class="body">

    <p class="greeting">
      Dear <strong>{{name}}</strong>,<br><br>
      Thank you for choosing <strong>Wanderlust Tours</strong>! We're thrilled to be part of your journey.
      Your booking is confirmed and a detailed invoice is attached to this email as a PDF document.
      Please keep this email and the invoice for your records.
    </p>

    <!-- Trip Details -->
    <div class="sec">
      <div class="sec-title">&#9992; Trip Details</div>
      <div class="dg">
        <div class="dr"><span class="dl">Tour Package</span><span class="dv">{{tour_title}}</span></div>
        <div class="dr"><span class="dl">Destination</span><span class="dv">{{destination}}</span></div>
        <div class="dr"><span class="dl">Travel Start</span><span class="dv">{{start_date}}</span></div>
        <div class="dr"><span class="dl">Travel End</span><span class="dv">{{end_date}}</span></div>
        <div class="dr"><span class="dl">Duration</span><span class="dv">{{duration}}</span></div>
        <div class="dr"><span class="dl">Travelers</span><span class="dv">{{travelers}}</span></div>
        <div class="dr"><span class="dl">Booking Date</span><span class="dv">{{booking_date}}</span></div>
      </div>
    </div>

    <!-- Payment Summary -->
    <div class="sec">
      <div class="sec-title">&#128179; Payment Summary</div>
      <div class="pg">
        <div class="pr"><span>Tour Price ({{travelers}})</span><span>{{total}}</span></div>
        <div class="pr"><span>Payment Method</span><span>{{payment_method}}</span></div>
        <div class="pr pr-total"><span class="pl">Total Charged</span><span class="pv">{{total}}</span></div>
      </div>
    </div>

    <!-- Invoice Note -->
    <div class="att">
      &#128206; <strong>Invoice {{invoice_number}}</strong> has been attached to this email as a PDF.
      Please save it for expense reimbursement or record-keeping purposes.
    </div>

    <!-- What's Next -->
    <div class="next">
      <div class="next-title">&#128197; What Happens Next?</div>
      <div class="next-item">Our team will prepare your trip itinerary and send it 7 days before departure.</div>
      <div class="next-item">You'll receive a reminder email 24 hours before your travel date.</div>
      <div class="next-item">Contact us if you need to modify your booking or have any questions.</div>
    </div>

  </div>

  <!-- Footer -->
  <div class="ftr">
    <p class="ftr-brand">&#9992; Wanderlust Tours</p>
    <p>Booking Reference: <strong>{{booking_reference}}</strong> &nbsp;|&nbsp; Invoice: <strong>{{invoice_number}}</strong></p>
    <div class="ftr-divider"></div>
    <p>This is an automated confirmation. Please do not reply directly to this email.</p>
    <p>For support, contact us at <a href="mailto:support@wanderlust.tours" style="color:#1a56db">support@wanderlust.tours</a></p>
    <p style="margin-top:8px">&#169; 2026 Wanderlust Tours &nbsp;&bull;&nbsp; All rights reserved</p>
    <p style="font-size:11px;color:#d1d5db;margin-top:4px">Cancellation policy applies per tour terms.</p>
  </div>

</div>
</div>
</body>
</html>
""";

    private static final String PASSWORD_RESET_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Password Reset Code - Wanderlust Tours</title>
<style>
  body{margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}
  .wrap{padding:30px 12px}
  .card{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.1)}
  .hdr{background:linear-gradient(135deg,#1a56db 0%,#1e3a8a 100%);padding:28px 32px}
  .brand{color:#fff;font-size:23px;font-weight:800;margin:0}
  .tag{color:#bfdbfe;font-size:13px;margin-top:6px}
  .body{padding:28px 32px}
  .title{margin:0 0 10px;color:#111827;font-size:22px;font-weight:700}
  .lead{color:#4b5563;font-size:14px;line-height:1.7;margin:0 0 20px}
  .code-box{background:#eff6ff;border:2px dashed #93c5fd;border-radius:12px;padding:16px;text-align:center;margin:18px 0}
  .code-label{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;font-weight:700}
  .code{font-size:34px;letter-spacing:8px;color:#1e40af;font-weight:800;margin-top:6px}
  .note{background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:12px 14px;font-size:13px;color:#9a3412;line-height:1.6}
  .ftr{border-top:1px solid #e5e7eb;padding:18px 32px;background:#f9fafb;font-size:12px;color:#6b7280;text-align:center}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="hdr">
        <p class="brand">Wanderlust Tours</p>
        <p class="tag">Secure account recovery</p>
      </div>
      <div class="body">
        <h2 class="title">Password Reset Verification</h2>
        <p class="lead">Hi <strong>{{name}}</strong>, we received a request to reset your password. Use the code below to continue.</p>
        <div class="code-box">
          <div class="code-label">Your Verification Code</div>
          <div class="code">{{code}}</div>
        </div>
        <div class="note">
          This code expires in <strong>{{expires}} minutes</strong>. If you did not request this, you can safely ignore this email.
        </div>
      </div>
      <div class="ftr">
        This is an automated message from Wanderlust Tours. Do not share this code with anyone.
      </div>
    </div>
  </div>
</body>
</html>
""";

    // ── Cancellation template ─────────────────────────────────────────────────

    public String cancellationConfirmation(NotificationDtos.BookingCancellationRequest r) {
        String name      = safe(r.customerName(), "Valued Customer");
        String ref       = safe(r.bookingReference(), "—");
        String inv       = safe(r.invoiceNumber(), "—");
        String tour      = safe(r.tourTitle(), "Your Tour");
        String dest      = safe(r.destinationName(), "—");
        String start     = fmtDate(r.travelStartDate());
        String end       = fmtDate(r.travelEndDate());
        String dur       = deriveDurationLabel(r.durationDays(), r.travelStartDate(), r.travelEndDate());
        String travelers = r.numberOfTravelers() != null
                ? r.numberOfTravelers() + (r.numberOfTravelers() == 1 ? " person" : " people") : "—";
        String amount    = fmtMoney(r.totalAmount());
        String cancelDate = safe(r.cancellationDate(), fmtDate(null));

        return CANCEL_TEMPLATE
                .replace("{{customer_name}}", name)
                .replace("{{booking_reference}}", ref)
                .replace("{{invoice_number}}", inv)
                .replace("{{tour_title}}", tour)
                .replace("{{destination}}", dest)
                .replace("{{start_date}}", start)
                .replace("{{end_date}}", end)
                .replace("{{duration}}", dur)
                .replace("{{travelers}}", travelers)
                .replace("{{refund_amount}}", amount)
                .replace("{{cancellation_date}}", cancelDate);
    }

    private String deriveDurationLabel(Integer durationDays, String startIso, String endIso) {
        try {
            if (startIso != null && !startIso.isBlank() && endIso != null && !endIso.isBlank()) {
                long days = ChronoUnit.DAYS.between(LocalDate.parse(startIso), LocalDate.parse(endIso)) + 1;
                if (days > 0) return days + " days";
            }
        } catch (Exception ignored) {}
        if (durationDays != null && durationDays > 0) return durationDays + " days";
        return "—";
    }

    private static final String UPDATE_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Booking Updated – Wanderlust Tours</title>
<style>
  body{margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}
  .wrap{width:100%;padding:32px 12px;background:#f0f4f8;box-sizing:border-box}
  .card{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.10)}
  .hdr{background:linear-gradient(135deg,#1a56db 0%,#1e3a8a 100%);padding:36px 40px 28px;text-align:center}
  .hdr-logo{font-size:26px;font-weight:800;color:#fff;margin:0 0 4px;letter-spacing:-.3px}
  .hdr-tag{font-size:13px;color:rgba(255,255,255,.65);margin:0}
  .banner{background:#fff7ed;border-bottom:1px solid #fed7aa;padding:26px 40px 20px;text-align:center}
  .banner h2{margin:0 0 6px;color:#9a3412;font-size:22px;font-weight:700}
  .banner p{margin:0;color:#b45309;font-size:14px;line-height:1.5}
  .ref-box{margin:24px 40px 0;padding:18px 24px;background:#eff6ff;border:2px dashed #93c5fd;border-radius:12px;text-align:center}
  .ref-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#6b7280;margin-bottom:6px}
  .ref-value{font-size:30px;font-weight:800;color:#1e40af;letter-spacing:3px}
  .body{padding:28px 40px 36px}
  .greeting{font-size:15px;color:#374151;line-height:1.7;margin:0 0 24px}
  .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid #f3f4f6}
  .dg{background:#f9fafb;border-radius:10px;overflow:hidden;border:1px solid #f3f4f6}
  .dr{display:flex;justify-content:space-between;align-items:center;padding:10px 18px;font-size:14px}
  .dr+.dr{border-top:1px solid #f3f4f6}
  .dl{color:#6b7280}
  .dv{color:#111827;font-weight:600;text-align:right}
  .ftr{background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center}
  .ftr p{font-size:12px;color:#9ca3af;margin:3px 0;line-height:1.6}
</style>
</head>
<body>
<div class="wrap">
<div class="card">
  <div class="hdr">
    <p class="hdr-logo">&#9992; Wanderlust Tours</p>
    <p class="hdr-tag">Your journey begins here</p>
  </div>
  <div class="banner">
    <h2>Booking Updated</h2>
    <p>Your booking details were successfully updated.</p>
  </div>
  <div class="ref-box">
    <div class="ref-label">Booking Reference</div>
    <div class="ref-value">{{booking_reference}}</div>
  </div>
  <div class="body">
    <p class="greeting">
      Dear <strong>{{name}}</strong>,<br><br>
      Your booking has been modified. Please review the updated trip details below.
    </p>
    <div class="sec-title">&#9992; Updated Trip Details</div>
    <div class="dg">
      <div class="dr"><span class="dl">Tour Package</span><span class="dv">{{tour_title}}</span></div>
      <div class="dr"><span class="dl">Destination</span><span class="dv">{{destination}}</span></div>
      <div class="dr"><span class="dl">Travel Start</span><span class="dv">{{start_date}}</span></div>
      <div class="dr"><span class="dl">Travel End</span><span class="dv">{{end_date}}</span></div>
      <div class="dr"><span class="dl">Duration</span><span class="dv">{{duration}}</span></div>
      <div class="dr"><span class="dl">Travelers</span><span class="dv">{{travelers}}</span></div>
      <div class="dr"><span class="dl">Updated Total</span><span class="dv">{{total}}</span></div>
      <div class="dr"><span class="dl">Updated At</span><span class="dv">{{updated_at}}</span></div>
    </div>
  </div>
  <div class="ftr">
    <p>This is an automated update. For support, contact support@wanderlust.tours</p>
    <p>&#169; 2026 Wanderlust Tours</p>
  </div>
</div>
</div>
</body>
</html>
""";

    private static final String CANCEL_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Booking Cancellation — Wanderlust Tours</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;color:#1f2937}
  .wrap{max-width:620px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)}
  .hdr{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:36px 32px 28px}
  .brand{color:#fff;font-size:22px;font-weight:700;letter-spacing:.5px}
  .hdr-sub{color:#94a3b8;font-size:13px;margin-top:4px}
  .alert-band{background:#dc2626;color:#fff;text-align:center;padding:10px 16px;font-weight:600;font-size:14px;letter-spacing:.3px}
  .body{padding:28px 32px}
  .hi{font-size:18px;font-weight:600;margin-bottom:8px}
  .lead{font-size:14px;color:#6b7280;line-height:1.7;margin-bottom:20px}
  .ref-box{background:#fef3f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px}
  .ref-label{font-size:11px;font-weight:700;color:#dc2626;letter-spacing:1.2px;text-transform:uppercase}
  .ref-val{font-size:20px;font-weight:800;color:#dc2626;margin-top:2px;font-family:monospace}
  .ref-date{font-size:13px;color:#6b7280;margin-top:6px}
  .sec{background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:18px}
  .sec-title{font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:10px}
  .dg{display:grid;gap:6px}
  .dr{display:flex;justify-content:space-between;font-size:14px;padding:4px 0;border-bottom:1px solid #e5e7eb}
  .dr:last-child{border-bottom:none}
  .dl{color:#6b7280}
  .dv{font-weight:600;color:#111827}
  .refund-box{background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px 20px;margin-bottom:18px;text-align:center}
  .refund-label{font-size:11px;font-weight:700;color:#047857;letter-spacing:1.2px;text-transform:uppercase}
  .refund-amount{font-size:28px;font-weight:800;color:#047857;margin-top:4px}
  .refund-note{font-size:13px;color:#6b7280;margin-top:6px}
  .att{background:#fef9c3;border-left:4px solid #f59e0b;border-radius:4px;padding:12px 16px;font-size:13px;color:#78350f;margin-bottom:18px;line-height:1.6}
  .ftr{background:#1e293b;padding:24px 32px;text-align:center;color:#94a3b8;font-size:12px}
  .ftr-brand{color:#fff;font-size:15px;font-weight:700;margin-bottom:8px}
  .ftr-divider{border-top:1px solid #334155;margin:12px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="brand">&#9992; Wanderlust Tours</div>
    <div class="hdr-sub">Your travel partner</div>
  </div>

  <div class="alert-band">&#10060; Booking Cancellation Confirmed</div>

  <div class="body">
    <p class="hi">Hi {{customer_name}},</p>
    <p class="lead">
      We've processed the cancellation of your booking <strong>{{booking_reference}}</strong>.
      A full refund has been initiated and the refund invoice is attached to this email.
    </p>

    <div class="ref-box">
      <div class="ref-label">Cancelled Booking Reference</div>
      <div class="ref-val">{{booking_reference}}</div>
      <div class="ref-date">Cancelled on {{cancellation_date}}</div>
    </div>

    <div class="sec">
      <div class="sec-title">&#128197; Trip Details</div>
      <div class="dg">
        <div class="dr"><span class="dl">Tour Package</span><span class="dv">{{tour_title}}</span></div>
        <div class="dr"><span class="dl">Destination</span><span class="dv">{{destination}}</span></div>
        <div class="dr"><span class="dl">Travel Start</span><span class="dv">{{start_date}}</span></div>
        <div class="dr"><span class="dl">Travel End</span><span class="dv">{{end_date}}</span></div>
        <div class="dr"><span class="dl">Duration</span><span class="dv">{{duration}}</span></div>
        <div class="dr"><span class="dl">Travelers</span><span class="dv">{{travelers}}</span></div>
      </div>
    </div>

    <div class="refund-box">
      <div class="refund-label">&#9989; Refund Processed</div>
      <div class="refund-amount">{{refund_amount}}</div>
      <div class="refund-note">Refund will reflect in 5–7 business days depending on your bank.</div>
    </div>

    <div class="att">
      &#128206; <strong>Refund Invoice {{invoice_number}}</strong> has been attached to this email as a PDF.
      Please retain it for your records.
    </div>
  </div>

  <div class="ftr">
    <p class="ftr-brand">&#9992; Wanderlust Tours</p>
    <p>Booking Reference: <strong>{{booking_reference}}</strong></p>
    <div class="ftr-divider"></div>
    <p>This is an automated notification. For support: <a href="mailto:support@wanderlust.tours" style="color:#93c5fd">support@wanderlust.tours</a></p>
    <p style="margin-top:8px">&#169; 2026 Wanderlust Tours &nbsp;&bull;&nbsp; All rights reserved</p>
  </div>
</div>
</body>
</html>
""";
}
