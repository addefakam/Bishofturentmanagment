import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_PAYMENT = {
  trialDays: 15,
  warningDays: 7,
  graceDays: 2,
  defaultCycle: "MONTHLY",
  paymentMethod: "manual",
  latePaymentPenalty: 10,
  enableAutoReminder: true,
  reminderDaysBefore: 7,
  currency: "ETB",
  currencySymbol: "Br",
  paymentInstructions:
    "Contact your administrator to arrange payment. Payments can be made via bank transfer or mobile money.",
};

export async function GET() {
  try {
    const sysSettings = await db.settings.findFirst({
      where: { providerId: null },
    });

    if (sysSettings?.configJson && typeof sysSettings.configJson === "object") {
      const config = sysSettings.configJson as Record<string, unknown>;
      const payment = config.payment;
      if (payment && typeof payment === "object") {
        return NextResponse.json({ ...DEFAULT_PAYMENT, ...payment });
      }
    }

    return NextResponse.json(DEFAULT_PAYMENT);
  } catch {
    return NextResponse.json(DEFAULT_PAYMENT);
  }
}
