import {
  MilliSatoshis,
  Satoshis,
  Seconds,
  UnixTimestamp,
} from "@/domain/units/index.types"
import { Cursor } from "@/domain/index.types"
import {
  ensureUnixSeconds,
  fromCursor,
  toCursor,
  toMilliSatoshis,
  toMinutes,
  toSatoshis,
  toUnixSeconds,
} from "@/domain/units"

describe("toMilliSatoshis", () => {
  it("converts sats to msats", () => {
    expect(toMilliSatoshis(1 as Satoshis)).toBe(1000 as MilliSatoshis)
    expect(toMilliSatoshis(123.456 as Satoshis)).toBe(123456 as MilliSatoshis)
  })

  it("rounds to nearest msat", () => {
    expect(toMilliSatoshis(1.001 as Satoshis)).toBe(1001 as MilliSatoshis)
    expect(toMilliSatoshis(1.0004 as Satoshis)).toBe(1000 as MilliSatoshis)
  })

  it("returns 0 for invalid input", () => {
    expect(toMilliSatoshis(undefined)).toBe(0 as MilliSatoshis)
    expect(toMilliSatoshis(null as unknown as Satoshis)).toBe(0 as MilliSatoshis)
    expect(toMilliSatoshis(NaN as unknown as Satoshis)).toBe(0 as MilliSatoshis)
    expect(toMilliSatoshis(Infinity as unknown as Satoshis)).toBe(0 as MilliSatoshis)
  })
})

describe("toSatoshis", () => {
  it("converts msats to sats", () => {
    expect(toSatoshis(1000 as MilliSatoshis)).toBe(1)
    expect(toSatoshis(5000 as MilliSatoshis)).toBe(5)
  })

  it("rounds to nearest sat", () => {
    expect(toSatoshis(1001 as MilliSatoshis)).toBe(1)
    expect(toSatoshis(1499 as MilliSatoshis)).toBe(1)
    expect(toSatoshis(1500 as MilliSatoshis)).toBe(2)
    expect(toSatoshis(123456 as MilliSatoshis)).toBe(123)
  })

  it("returns 0 for invalid input", () => {
    expect(toSatoshis(undefined)).toBe(0 as Satoshis)
    expect(toSatoshis(null as unknown as MilliSatoshis)).toBe(0)
    expect(toSatoshis(NaN as unknown as MilliSatoshis)).toBe(0)
    expect(toSatoshis(Infinity as unknown as MilliSatoshis)).toBe(0)
  })
})

describe("toUnixSeconds", () => {
  it("floors valid numbers", () => {
    expect(toUnixSeconds(1234.9)).toBe(1234)
  })

  it("returns undefined for invalid numbers", () => {
    expect(toUnixSeconds(undefined)).toBeUndefined()
    expect(toUnixSeconds(null as unknown as number)).toBeUndefined()
    expect(toUnixSeconds(NaN)).toBeUndefined()
    expect(toUnixSeconds(Infinity)).toBeUndefined()
  })
})

describe("ensureUnixSeconds", () => {
  const realNow = Date.now

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    Date.now = realNow
  })

  it("returns floored value when valid", () => {
    expect(ensureUnixSeconds(1234.9)).toBe(1234)
  })

  it("returns current unix timestamp when value is invalid", () => {
    const fakeMs = 1_700_000_000_000
    jest.setSystemTime(fakeMs)

    const ts = ensureUnixSeconds(undefined)
    expect(typeof ts).toBe("number")
    expect(ts).toBe(Math.floor(fakeMs / 1000))
  })
})

describe("toMinutes", () => {
  it("converts seconds to minutes (multiplying by 60)", () => {
    expect(toMinutes(1 as Seconds)).toBe(1 / 60)
    expect(toMinutes(10 as Seconds)).toBe(1 / 6)
  })

  it("returns undefined for falsy values (0, null, undefined)", () => {
    expect(toMinutes(undefined)).toBeUndefined()
    expect(toMinutes(null as unknown as Seconds)).toBeUndefined()
    expect(toMinutes(0 as Seconds)).toBeUndefined()
  })
})

describe("toCursor / fromCursor", () => {
  describe("toCursor", () => {
    it("returns undefined for falsy values", () => {
      expect(toCursor(0 as UnixTimestamp)).toBeUndefined()
      expect(toCursor(null as any)).toBeUndefined()
      expect(toCursor(undefined as any)).toBeUndefined()
    })

    it("generates valid 24-character hex string", () => {
      const ts = 1703520000 as UnixTimestamp
      const cursor = toCursor(ts) as Cursor

      expect(cursor).toMatch(/^[0-9a-f]{24}$/)
      expect(cursor.length).toBe(24)
    })

    it("encodes timestamp in first 4 bytes (big-endian)", () => {
      const ts = 0x12345678 as UnixTimestamp
      const cursor = toCursor(ts) as Cursor

      expect(cursor.slice(0, 8)).toBe("12345678")
      expect(cursor.slice(8)).toBe("0000000000000000")
    })

    it("handles maximum 32-bit timestamp", () => {
      const maxTimestamp = 0xffffffff as UnixTimestamp
      const cursor = toCursor(maxTimestamp) as Cursor

      expect(cursor.slice(0, 8)).toBe("ffffffff")
      expect(fromCursor(cursor)).toBe(maxTimestamp)
    })

    it("handles minimum valid timestamp", () => {
      const minTimestamp = 1 as UnixTimestamp
      const cursor = toCursor(minTimestamp) as Cursor

      expect(cursor.slice(0, 8)).toBe("00000001")
      expect(fromCursor(cursor)).toBe(minTimestamp)
    })

    it("floors fractional timestamps", () => {
      const ts = 1703520000.999 as UnixTimestamp
      const cursor = toCursor(ts) as Cursor
      const decoded = fromCursor(cursor)

      expect(decoded).toBe(1703520000)
    })

    it("generates sortable cursors (newer timestamps = higher hex)", () => {
      const ts1 = 1000000 as UnixTimestamp
      const ts2 = 2000000 as UnixTimestamp
      const cursor1 = toCursor(ts1) as Cursor
      const cursor2 = toCursor(ts2) as Cursor

      expect(cursor1 < cursor2).toBe(true)
    })
  })

  describe("fromCursor", () => {
    it("returns undefined for undefined input", () => {
      expect(fromCursor(undefined)).toBeUndefined()
    })

    it("decodes timestamp from first 8 hex characters (4 bytes)", () => {
      const ts = 1703520000 as UnixTimestamp
      const cursor = toCursor(ts) as Cursor
      const decoded = fromCursor(cursor)

      expect(decoded).toBe(ts)
    })

    it("ignores trailing bytes after timestamp", () => {
      const ts = 42 as UnixTimestamp
      const cursor = toCursor(ts) as Cursor
      const modified = (cursor.slice(0, 8) + "fedcba9876543210") as Cursor

      expect(fromCursor(modified)).toBe(ts)
    })

    it("handles edge case timestamps correctly", () => {
      const testCases = [
        1 as UnixTimestamp,
        255 as UnixTimestamp,
        65535 as UnixTimestamp,
        16777215 as UnixTimestamp,
        2147483647 as UnixTimestamp, // max i32
        4294967295 as UnixTimestamp, // max u32
      ]

      testCases.forEach((ts) => {
        const cursor = toCursor(ts) as Cursor
        const decoded = fromCursor(cursor)
        expect(decoded).toBe(ts)
      })
    })

    it("round-trips correctly for realistic timestamps", () => {
      const now = Math.floor(Date.now() / 1000) as UnixTimestamp
      const past = (now - 86400 * 365) as UnixTimestamp
      const future = (now + 86400 * 365) as UnixTimestamp

      ;[now, past, future].forEach((ts) => {
        const cursor = toCursor(ts) as Cursor
        const decoded = fromCursor(cursor)
        expect(decoded).toBe(ts)
      })
    })
  })

  describe("integration", () => {
    it("maintains ordering for pagination", () => {
      const timestamps = [1000000, 1500000, 2000000, 2500000, 3000000] as UnixTimestamp[]

      const cursors = timestamps.map((ts) => toCursor(ts)).filter(Boolean) as Cursor[]

      for (let i = 1; i < cursors.length; i++) {
        expect(cursors[i - 1] < cursors[i]).toBe(true)
      }

      const decoded = cursors.map(fromCursor)
      expect(decoded).toEqual(timestamps)
    })

    it("cursor format is compatible with MongoDB ObjectId structure", () => {
      const ts = 1703520000 as UnixTimestamp
      const cursor = toCursor(ts) as Cursor

      expect(cursor.length).toBe(24)
      expect(cursor).toMatch(/^[0-9a-f]{24}$/)

      const timestampHex = cursor.slice(0, 8)
      expect(parseInt(timestampHex, 16)).toBe(ts)

      expect(cursor.slice(8)).toBe("0000000000000000")
    })
  })
})
