import { describe, it, expect } from "vitest";
import { isPayPalCertUrl, checkTransmissionTime } from "../src/paypal/webhookGuard";

const now = new Date("2026-11-10T12:00:00Z");

describe("isPayPalCertUrl", () => {
  it("accepts sandbox and live PayPal certificate URLs", () => {
    expect(isPayPalCertUrl("https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1")).toBe(true);
    expect(isPayPalCertUrl("https://api.paypal.com/v1/notifications/certs/CERT-1")).toBe(true);
  });

  it("rejects plain http", () => {
    expect(isPayPalCertUrl("http://api.paypal.com/v1/notifications/certs/CERT-1")).toBe(false);
  });

  it("rejects look-alike domains", () => {
    expect(isPayPalCertUrl("https://evilpaypal.com/cert")).toBe(false);
    expect(isPayPalCertUrl("https://paypal.com.evil.com/cert")).toBe(false);
  });

  it("rejects the username trick", () => {
    expect(isPayPalCertUrl("https://api.paypal.com@evil.com/cert")).toBe(false);
  });

  it("rejects garbage", () => {
    expect(isPayPalCertUrl("not a url")).toBe(false);
    expect(isPayPalCertUrl("")).toBe(false);
  });
});

describe("checkTransmissionTime", () => {
  it("accepts a recent time", () => {
    expect(checkTransmissionTime("2026-11-10T11:59:00Z", now).ok).toBe(true);
  });

  it("accepts a retry a couple of days later", () => {
    expect(checkTransmissionTime("2026-11-08T12:00:00Z", now).ok).toBe(true);
  });

  it("rejects a time that is too old", () => {
    expect(checkTransmissionTime("2026-11-01T12:00:00Z", now).ok).toBe(false);
  });

  it("rejects a time in the future", () => {
    expect(checkTransmissionTime("2026-11-10T13:00:00Z", now).ok).toBe(false);
  });

  it("rejects an invalid time", () => {
    expect(checkTransmissionTime("yesterday", now).ok).toBe(false);
  });
});