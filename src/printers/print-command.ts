import { randomInt } from "node:crypto";

/** A broker publish is not a firmware acknowledgement or proof of motion. */
export async function publishPrintCommand(printer: any, payload: any, timeoutMs = 10000): Promise<any> {
  const sequence = String(randomInt(1, 2147483647));
  payload.print.sequence_id = sequence;
  return new Promise((resolve, reject) => {
    const finish = (result?: any, error?: Error) => {
      clearTimeout(timer);
      printer.removeListener("rawMessage", onMessage);
      if (error) reject(error); else resolve(result);
    };
    const onMessage = (_topic: string, raw: Buffer) => {
      let report;
      try { report = JSON.parse(raw.toString()).print; } catch { return; }
      if (!report || report.command !== payload.print.command || String(report.sequence_id) !== sequence) return;
      const result = String(report.result ?? "").toLowerCase();
      if (result === "failed" || result === "fail" || (report.err !== undefined && Number(report.err) !== 0)) {
        finish({ status: "error", accepted: false, started: false, message: `Printer rejected command: ${report.reason ?? report.err ?? result}` });
      } else if (result === "success") {
        finish({ status: "accepted", accepted: true, started: false, message: "Printer accepted command; print start and extrusion remain unverified. Check live job state and the plate." });
      }
    };
    const timer = setTimeout(() => finish({ status: "unverified", accepted: null, started: false, message: "No correlated printer acknowledgement received. Do not retry automatically; inspect live job state first." }), timeoutMs);
    printer.on("rawMessage", onMessage);
    Promise.resolve().then(() => printer.publish(payload)).catch(error => finish(undefined, error));
  });
}
