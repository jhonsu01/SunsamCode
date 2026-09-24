import { EOT_BYTE, endOfTokenByteDistributions, type SunsamMeshPort } from "./contract.js";

/** Ejemplo del paper (§2.2): tras "Tiram" el teacher reparte masa entre "isu", "isk" e "is". */
export function tiramisuExample() {
  const bytes = (text: string) => [...new TextEncoder().encode(text)];
  return endOfTokenByteDistributions(
    [
      { bytes: bytes("isu"), logprob: Math.log(0.5) },
      { bytes: bytes("isk"), logprob: Math.log(0.125) },
      { bytes: bytes("is"), logprob: Math.log(0.125) },
      { bytes: bytes("x"), logprob: Math.log(0.25) },
    ],
    bytes("isu"),
  ).map((position) => ({
    target: position.target === EOT_BYTE ? "<eot>" : String.fromCharCode(position.target),
    dist: position.dist,
  }));
}

export async function markLocalAnswerGood(
  port: SunsamMeshPort,
  decisionId: string,
): Promise<boolean> {
  return port.recordFeedback(decisionId, true);
}
