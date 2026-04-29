import { describe, test, expect } from "vitest"
import { buildManualPaymentLedgerInsert } from "./CreateManualReservationCommand"

describe("buildManualPaymentLedgerInsert", () => {
  test("should include created_by required by financial_transactions schema", () => {
    const insert = buildManualPaymentLedgerInsert({
      propertyId: "prop_123",
      reservationId: "res_123",
      amountCents: 5000,
      paymentMethod: "cash",
      createdBy: "user_123",
    })

    expect(insert).toMatchObject({
      property_id: "prop_123",
      reservation_id: "res_123",
      type: "payment",
      amount_cents: 5000,
      payment_method: "cash",
      status: "completed",
      source: "manual",
      is_voided: false,
      created_by: "user_123",
    })
  })
})

