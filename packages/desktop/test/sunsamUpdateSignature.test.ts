import { describe, expect, it } from "vitest";
import {
  SUNSAM_UPDATE_SIGNER_THUMBPRINTS,
  evaluateSunsamUpdateSignature,
} from "../src/main/sunsamUpdateSignature.js";

const sunsam = SUNSAM_UPDATE_SIGNER_THUMBPRINTS[0]!;
const subject = "CN=DevTest-JhonSupelano";

describe("Sunsam update signature (pinned certificate)", () => {
  it("accepts a fully trusted signature, like upstream", () => {
    expect(evaluateSunsamUpdateSignature({ status: 0, subject, thumbprint: "OTHER" })).toBeNull();
  });

  it("accepts an intact Sunsam signature on machines that do not trust its root", () => {
    expect(evaluateSunsamUpdateSignature({ status: 1, subject, thumbprint: sunsam })).toBeNull();
    expect(
      evaluateSunsamUpdateSignature({ status: 4, subject, thumbprint: sunsam.toLowerCase() }),
    ).toBeNull();
  });

  it("rejects untrusted signatures from any other certificate", () => {
    expect(
      evaluateSunsamUpdateSignature({ status: 1, subject, thumbprint: "A".repeat(40) }),
    ).toMatch(/not valid/);
  });

  it("rejects tampered, unsigned or subject-less files even with the Sunsam thumbprint", () => {
    expect(evaluateSunsamUpdateSignature({ status: 3, subject, thumbprint: sunsam })).toMatch(
      /not valid/,
    );
    expect(evaluateSunsamUpdateSignature({ status: 2, subject: null, thumbprint: null })).toMatch(
      /requires/,
    );
    expect(evaluateSunsamUpdateSignature({ status: 0, subject: " ", thumbprint: sunsam })).toMatch(
      /requires/,
    );
  });
});
