package com.tour.notification.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.tour.notification.dto.NotificationDtos;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

@Service
public class InvoicePdfService {

    // ── Brand colours ─────────────────────────────────────────────────────────
    private static final Color BRAND_BLUE    = new Color(26,  86, 219);
    private static final Color BRAND_DARK    = new Color(15,  23,  42);
    private static final Color TEXT_MAIN     = new Color(17,  24,  39);
    private static final Color TEXT_SUB      = new Color(107, 114, 128);
    private static final Color BG_LIGHT      = new Color(249, 250, 251);
    private static final Color BORDER        = new Color(229, 231, 235);
    private static final Color GREEN         = new Color( 16, 185, 129);
    private static final Color WHITE         = Color.WHITE;

    private static final DateTimeFormatter DISPLAY =
            DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);

    // ── Public API ─────────────────────────────────────────────────────────────

    public byte[] generate(NotificationDtos.BookingConfirmationRequest r) throws Exception {
        BigDecimal total = r.totalAmount() != null ? r.totalAmount() : BigDecimal.ZERO;
        return buildPdf(false, r.invoiceNumber(), r.bookingReference(), r.bookingDate(),
                r.customerName(), r.recipientEmail(),
                r.tourTitle(), r.destinationName(), r.travelStartDate(), r.travelEndDate(),
                r.durationDays(), r.numberOfTravelers(),
                r.paymentMethod(), total, BigDecimal.ZERO, total);
    }

    /** Generates a REFUND invoice from a cancellation request. */
    public byte[] generateRefund(NotificationDtos.BookingCancellationRequest r) throws Exception {
        java.math.BigDecimal refundAmt = r.totalAmount() != null ? r.totalAmount() : java.math.BigDecimal.ZERO;
        return buildPdf(true, r.invoiceNumber(), r.bookingReference(), r.cancellationDate(),
                r.customerName(), r.recipientEmail(),
                r.tourTitle(), r.destinationName(), r.travelStartDate(), r.travelEndDate(),
                r.durationDays(), r.numberOfTravelers(),
                "REFUND", refundAmt, java.math.BigDecimal.ZERO, refundAmt);
    }

    private byte[] buildPdf(boolean isRefund,
                             String invoiceNumber, String bookingRef, String docDate,
                             String customerName, String recipientEmail,
                             String tourTitle, String destination,
                             String startDate, String endDate,
                             Integer durationDays, Integer numTravelers,
                             String paymentMethod,
                             java.math.BigDecimal totalAmount,
                             java.math.BigDecimal processingFee,
                             java.math.BigDecimal grandTotal) throws Exception {
        // Build a temporary BookingConfirmationRequest-compatible document
        Document doc = new Document(PageSize.A4, 50f, 50f, 60f, 60f);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfWriter.getInstance(doc, out);
        doc.open();

        addLetterheadWithType(doc, isRefund);
        addInvoiceMetaRaw(doc, invoiceNumber, bookingRef, docDate, paymentMethod,
                isRefund ? "REFUNDED" : "PAID", numTravelers, durationDays, isRefund);
        addBillToRaw(doc, customerName, recipientEmail);
        addTripTableRaw(doc, tourTitle, destination, startDate, endDate, durationDays, numTravelers, invoiceNumber);
        addPaymentTableRaw(doc, tourTitle, numTravelers, totalAmount, processingFee, grandTotal, isRefund);
        addFooter(doc);

        doc.close();
        return out.toByteArray();
    }

    // ── Section builders ──────────────────────────────────────────────────────

    private void addLetterheadWithType(Document doc, boolean isRefund) throws Exception {
        addLetterhead(doc);
        if (isRefund) {
            Font refundBanner = new Font(Font.HELVETICA, 11, Font.BOLD, WHITE);
            Paragraph rb = new Paragraph("  REFUND INVOICE  ", refundBanner);
            PdfPTable refundBand = new PdfPTable(1);
            refundBand.setWidthPercentage(100);
            refundBand.setSpacingAfter(4f);
            PdfPCell rc = new PdfPCell(rb);
            rc.setBackgroundColor(new Color(217, 119, 6));
            rc.setPaddingTop(8f); rc.setPaddingBottom(8f); rc.setPaddingLeft(14f);
            rc.setBorder(Rectangle.NO_BORDER);
            refundBand.addCell(rc);
            doc.add(refundBand);
        }
    }

    private void addLetterhead(Document doc) throws Exception {
        // Header band: blue PdfPTable cell — avoids PdfContentByte coordinate mismatch
        Font logoFont = new Font(Font.HELVETICA, 20, Font.BOLD, WHITE);
        Paragraph logo = new Paragraph("\u2708  WANDERLUST TOURS", logoFont);
        logo.setAlignment(Element.ALIGN_LEFT);

        PdfPTable headerBand = new PdfPTable(1);
        headerBand.setWidthPercentage(100);
        headerBand.setSpacingAfter(8f);
        PdfPCell logoCell = new PdfPCell(logo);
        logoCell.setBackgroundColor(BRAND_BLUE);
        logoCell.setPaddingTop(20f);
        logoCell.setPaddingBottom(18f);
        logoCell.setPaddingLeft(14f);
        logoCell.setPaddingRight(14f);
        logoCell.setBorder(Rectangle.NO_BORDER);
        headerBand.addCell(logoCell);
        doc.add(headerBand);

        // Tagline
        Font tagFont = new Font(Font.HELVETICA, 9, Font.NORMAL, new Color(156, 163, 175));
        Paragraph tag = new Paragraph("Your journey begins here  \u2022  support@wanderlust.tours", tagFont);
        tag.setAlignment(Element.ALIGN_LEFT);
        tag.setSpacingAfter(14f);
        doc.add(tag);

        addHLine(doc);

        // Invoice label + paid stamp
        PdfPTable titleRow = new PdfPTable(2);
        titleRow.setWidthPercentage(100);
        titleRow.setWidths(new float[]{70f, 30f});
        titleRow.setSpacingBefore(10f);
        titleRow.setSpacingAfter(4f);

        Font invTitle = new Font(Font.HELVETICA, 26, Font.BOLD, BRAND_DARK);
        PdfPCell left = plainCell(new Paragraph("INVOICE", invTitle));
        left.setHorizontalAlignment(Element.ALIGN_LEFT);
        titleRow.addCell(left);

        // Green PAID badge
        Font paidFont = new Font(Font.HELVETICA, 13, Font.BOLD, WHITE);
        Paragraph paid = new Paragraph("  \u2713  PAID  ", paidFont);
        PdfPCell rightCell = new PdfPCell(paid);
        rightCell.setBackgroundColor(GREEN);
        rightCell.setPadding(8f);
        rightCell.setBorder(Rectangle.NO_BORDER);
        rightCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        rightCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        titleRow.addCell(rightCell);
        doc.add(titleRow);
    }

    private void addInvoiceMetaRaw(Document doc, String invoiceNumber, String bookingReference,
                                    String docDate, String paymentMethod, String paymentStatus,
                                    Integer numTravelers, Integer durationDays,
                                    boolean isRefund) throws Exception {
        PdfPTable meta = new PdfPTable(2);
        meta.setWidthPercentage(100);
        meta.setWidths(new float[]{50f, 50f});
        meta.setSpacingBefore(6f);
        meta.setSpacingAfter(18f);

        Font labelFont = new Font(Font.HELVETICA, 9, Font.BOLD, TEXT_SUB);
        Font valueFont = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_MAIN);
        Font valueBold = new Font(Font.HELVETICA, 10, Font.BOLD, TEXT_MAIN);

        String[][] leftRows = {
            {"Invoice Number",    safe(invoiceNumber,    "—")},
            {"Booking Reference", safe(bookingReference, "—")},
            {"Invoice Date",      fmtDate(null)},
            {isRefund ? "Cancellation Date" : "Booking Date", fmtDate(docDate)},
        };
        String pmLabel = safe(paymentMethod, "CREDIT_CARD").replace("_", " ");
        String[][] rightRows = {
            {isRefund ? "Transaction Type" : "Payment Method", pmLabel},
            {"Status",          safe(paymentStatus, "PAID")},
            {"No. of Travelers", numTravelers != null ? String.valueOf(numTravelers) : "—"},
            {"Duration",         durationDays != null ? durationDays + " days" : "—"},
        };

        PdfPCell leftCell  = new PdfPCell();
        PdfPCell rightCell = new PdfPCell();
        leftCell.setBorder(Rectangle.NO_BORDER);
        rightCell.setBorder(Rectangle.NO_BORDER);

        Color statusColor = isRefund ? new Color(217, 119, 6) : GREEN;
        for (String[] row : leftRows) {
            Paragraph lbl = new Paragraph(row[0], labelFont); lbl.setSpacingBefore(4f);
            Paragraph val = new Paragraph(row[1], row[0].contains("Reference") || row[0].contains("Number") ? valueBold : valueFont);
            leftCell.addElement(lbl); leftCell.addElement(val);
        }
        for (String[] row : rightRows) {
            Paragraph lbl = new Paragraph(row[0], labelFont); lbl.setSpacingBefore(4f);
            boolean isStatus = row[0].equals("Status");
            Paragraph val = new Paragraph(row[1], isStatus ? new Font(Font.HELVETICA, 10, Font.BOLD, statusColor) : valueFont);
            rightCell.addElement(lbl); rightCell.addElement(val);
        }

        meta.addCell(leftCell);
        meta.addCell(rightCell);
        doc.add(meta);
        addHLine(doc);
    }

    private void addBillToRaw(Document doc, String customerName, String recipientEmail) throws Exception {
        Font secHdr = new Font(Font.HELVETICA, 9, Font.BOLD, TEXT_SUB);
        Font nameFont = new Font(Font.HELVETICA, 13, Font.BOLD, TEXT_MAIN);
        Font emailFont = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_SUB);

        Paragraph lbl = new Paragraph("BILL TO", secHdr);
        lbl.setSpacingBefore(14f); lbl.setSpacingAfter(4f);
        doc.add(lbl);

        Paragraph name = new Paragraph(safe(customerName, "Valued Customer"), nameFont);
        name.setSpacingAfter(2f);
        doc.add(name);

        Paragraph email = new Paragraph(safe(recipientEmail, ""), emailFont);
        email.setSpacingAfter(16f);
        doc.add(email);
        addHLine(doc);
    }

    private void addTripTableRaw(Document doc, String tourTitle, String destination,
                                  String startDate, String endDate,
                                  Integer durationDays, Integer numTravelers,
                                  String invoiceNumber) throws Exception {
        Font secHdr = new Font(Font.HELVETICA, 9, Font.BOLD, TEXT_SUB);
        Paragraph lbl = new Paragraph("TOUR / BOOKING DETAILS", secHdr);
        lbl.setSpacingBefore(14f); lbl.setSpacingAfter(8f);
        doc.add(lbl);

        PdfPTable t = new PdfPTable(2);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{38f, 62f});
        t.setSpacingAfter(16f);

        String travelerStr = numTravelers != null
                ? numTravelers + (numTravelers == 1 ? " person" : " people") : "—";

        String durationLabel = deriveDurationLabel(durationDays, startDate, endDate);
        String[][] rows = {
            {"Tour Package",       safe(tourTitle,    "—")},
            {"Destination",        safe(destination,  "—")},
            {"Travel Start Date",  fmtDate(startDate)},
            {"Travel End Date",    fmtDate(endDate)},
            {"Duration",           durationLabel},
            {"Number of Travelers", travelerStr},
            {"Invoice Number",     safe(invoiceNumber, "—")},
        };

        Font keyFont = new Font(Font.HELVETICA, 10, Font.BOLD, TEXT_MAIN);
        Font valFont = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_MAIN);
        for (int i = 0; i < rows.length; i++) {
            addTableRow(t, rows[i][0], rows[i][1], keyFont, valFont, (i % 2 == 0) ? WHITE : BG_LIGHT);
        }
        doc.add(t);
        addHLine(doc);
    }

    private void addPaymentTableRaw(Document doc, String tourTitle, Integer numTravelers,
                                     java.math.BigDecimal totalAmount,
                                     java.math.BigDecimal processingFee,
                                     java.math.BigDecimal grandTotal,
                                     boolean isRefund) throws Exception {
        Font secHdr = new Font(Font.HELVETICA, 9, Font.BOLD, TEXT_SUB);
        Paragraph lbl = new Paragraph(isRefund ? "REFUND BREAKDOWN" : "PAYMENT BREAKDOWN", secHdr);
        lbl.setSpacingBefore(14f); lbl.setSpacingAfter(8f);
        doc.add(lbl);

        PdfPTable t = new PdfPTable(3);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{55f, 20f, 25f});
        t.setSpacingAfter(20f);

        Font colHdr = new Font(Font.HELVETICA, 9, Font.BOLD, WHITE);
        String[] headers = {"Description", "Qty / Note", "Amount"};
        for (String h : headers) {
            PdfPCell c = new PdfPCell(new Phrase(h, colHdr));
            c.setBackgroundColor(BRAND_BLUE);
            c.setPadding(9f);
            c.setBorderColor(BRAND_BLUE);
            c.setHorizontalAlignment(h.equals("Amount") ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
            t.addCell(c);
        }

        Font rowFont  = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_MAIN);
        Font boldFont = new Font(Font.HELVETICA, 11, Font.BOLD, WHITE);
        Color totalBg = isRefund ? new Color(217, 119, 6) : BRAND_BLUE;
        BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;

        int travelers = numTravelers != null ? numTravelers : 1;
        addPayRow(t, "Tour Package: " + safe(tourTitle, "—"), "\u00d7 " + travelers, fmtMoney(total), rowFont, WHITE);
        if (!isRefund) {
            // Tax / processing fee removed from invoice.
        }

        String totalLabel = isRefund ? "REFUND AMOUNT" : "TOTAL AMOUNT CHARGED";
        PdfPCell descCell = new PdfPCell(new Phrase(totalLabel, boldFont));
        descCell.setBackgroundColor(totalBg); descCell.setPadding(11f); descCell.setColspan(2);
        descCell.setBorderColor(totalBg);
        t.addCell(descCell);

        Font totalAmtFont = new Font(Font.HELVETICA, 12, Font.BOLD, WHITE);
        PdfPCell totalAmt = new PdfPCell(new Phrase(fmtMoney(total), totalAmtFont));
        totalAmt.setBackgroundColor(totalBg); totalAmt.setPadding(11f);
        totalAmt.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totalAmt.setBorderColor(totalBg);
        t.addCell(totalAmt);

        doc.add(t);

        Font thankFont = new Font(Font.HELVETICA, 10, Font.ITALIC, TEXT_SUB);
        String msg = isRefund
                ? "Your refund has been processed. We hope to welcome you on a future journey with Wanderlust Tours."
                : "Thank you for choosing Wanderlust Tours. We look forward to making your journey unforgettable!";
        Paragraph thank = new Paragraph(msg, thankFont);
        thank.setAlignment(Element.ALIGN_CENTER);
        thank.setSpacingAfter(12f);
        doc.add(thank);
        addHLine(doc);
    }

    private void addFooter(Document doc) throws Exception {
        Font footFont = new Font(Font.HELVETICA, 8, Font.NORMAL, TEXT_SUB);
        Font footBold = new Font(Font.HELVETICA, 8, Font.BOLD, TEXT_SUB);

        Paragraph f1 = new Paragraph("\u00a9 2026 Wanderlust Tours  \u2022  All rights reserved  \u2022  support@wanderlust.tours", footBold);
        f1.setAlignment(Element.ALIGN_CENTER);
        f1.setSpacingBefore(10f);
        f1.setSpacingAfter(4f);
        doc.add(f1);

        Paragraph f2 = new Paragraph(
            "This is a system-generated invoice. No signature is required. " +
            "Cancellation and refund policies apply as per tour terms and conditions. " +
            "Please retain this invoice for your records.", footFont);
        f2.setAlignment(Element.ALIGN_CENTER);
        doc.add(f2);
    }

    // ── Low-level helpers ─────────────────────────────────────────────────────

    private void addHLine(Document doc) throws Exception {
        PdfPTable line = new PdfPTable(1);
        line.setWidthPercentage(100);
        line.setSpacingBefore(3f);
        line.setSpacingAfter(5f);
        PdfPCell cell = new PdfPCell();
        cell.setMinimumHeight(0.5f);
        cell.setBorderWidthTop(0);
        cell.setBorderWidthLeft(0);
        cell.setBorderWidthRight(0);
        cell.setBorderWidthBottom(0.5f);
        cell.setBorderColorBottom(BORDER);
        cell.setPadding(0);
        line.addCell(cell);
        doc.add(line);
    }

    private PdfPCell plainCell(Paragraph p) {
        PdfPCell c = new PdfPCell(p);
        c.setBorder(Rectangle.NO_BORDER);
        c.setPaddingTop(4f);
        c.setPaddingBottom(4f);
        return c;
    }

    private void addTableRow(PdfPTable t, String key, String value,
                             Font kf, Font vf, Color bg) {
        PdfPCell kc = new PdfPCell(new Phrase(key, kf));
        kc.setBackgroundColor(bg); kc.setPadding(8f); kc.setBorderColor(BORDER);
        PdfPCell vc = new PdfPCell(new Phrase(value, vf));
        vc.setBackgroundColor(bg); vc.setPadding(8f); vc.setBorderColor(BORDER);
        t.addCell(kc); t.addCell(vc);
    }

    private void addPayRow(PdfPTable t, String desc, String qty, String amount,
                           Font f, Color bg) {
        PdfPCell dc = new PdfPCell(new Phrase(desc,   f)); dc.setBackgroundColor(bg); dc.setPadding(9f); dc.setBorderColor(BORDER); t.addCell(dc);
        PdfPCell qc = new PdfPCell(new Phrase(qty,    f)); qc.setBackgroundColor(bg); qc.setPadding(9f); qc.setBorderColor(BORDER); t.addCell(qc);
        PdfPCell ac = new PdfPCell(new Phrase(amount, f)); ac.setBackgroundColor(bg); ac.setPadding(9f); ac.setBorderColor(BORDER);
        ac.setHorizontalAlignment(Element.ALIGN_RIGHT); t.addCell(ac);
    }

    private static String safe(String v, String fallback) {
        return (v != null && !v.isBlank()) ? v : fallback;
    }

    private static String fmtDate(String iso) {
        if (iso == null || iso.isBlank()) return LocalDate.now().format(DISPLAY);
        try { return LocalDate.parse(iso).format(DISPLAY); } catch (Exception e) { return iso; }
    }

    private static String deriveDurationLabel(Integer durationDays, String startIso, String endIso) {
        try {
            if (startIso != null && !startIso.isBlank() && endIso != null && !endIso.isBlank()) {
                long days = ChronoUnit.DAYS.between(LocalDate.parse(startIso), LocalDate.parse(endIso)) + 1;
                if (days > 0) return days + " days";
            }
        } catch (Exception ignored) {}
        if (durationDays != null && durationDays > 0) return durationDays + " days";
        return "—";
    }

    private static String fmtMoney(BigDecimal v) {
        if (v == null) return "—";
        return String.format("$%,.2f", v);
    }
}
