import type { ReservationStatus } from "@/contracts/booking"
import { describe, expect, test } from "vitest"
import {
    findBlockingReservationOnSiteForMove,
    reservationStayIntervalsOverlapIso,
} from "./reservation-timeline"

describe("reservationStayIntervalsOverlapIso", () => {
    test("returns false when existing checks out on moving check-in (same-day turnover)", () => {
        expect(
            reservationStayIntervalsOverlapIso("2026-07-10", "2026-07-15", "2026-07-05", "2026-07-10")
        ).toBe(false)
    })

    test("returns true when stays strictly overlap", () => {
        expect(
            reservationStayIntervalsOverlapIso("2026-07-10", "2026-07-15", "2026-07-12", "2026-07-18")
        ).toBe(true)
    })
})

describe("findBlockingReservationOnSiteForMove", () => {
    const base = {
        siteId: "site-a",
        checkIn: "2026-07-10",
        checkOut: "2026-07-15",
    }

    test("returns null when only cancelled reservation overlaps on target site", () => {
        const reservations = [
            {
                id: "moving",
                siteId: "site-b",
                status: "confirmed" as ReservationStatus,
                checkIn: "2026-07-10",
                checkOut: "2026-07-15",
            },
            {
                id: "other",
                siteId: "site-a",
                status: "cancelled" as ReservationStatus,
                checkIn: "2026-07-11",
                checkOut: "2026-07-14",
            },
        ]
        expect(
            findBlockingReservationOnSiteForMove({
                movingReservationId: "moving",
                targetSiteId: "site-a",
                checkIn: "2026-07-10",
                checkOut: "2026-07-15",
                reservations,
            })
        ).toBeNull()
    })

    test("returns blocking reservation when confirmed stay overlaps on target site", () => {
        const block = {
            id: "blocker",
            siteId: "site-a",
            status: "confirmed" as ReservationStatus,
            checkIn: "2026-07-11",
            checkOut: "2026-07-14",
        }
        const reservations = [
            { id: "moving", ...base, siteId: "site-b", status: "confirmed" as ReservationStatus },
            block,
        ]
        expect(
            findBlockingReservationOnSiteForMove({
                movingReservationId: "moving",
                targetSiteId: "site-a",
                checkIn: "2026-07-10",
                checkOut: "2026-07-15",
                reservations,
            })
        ).toEqual(block)
    })
})
