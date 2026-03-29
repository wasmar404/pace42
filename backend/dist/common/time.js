"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.time = time;
exports.msSince = msSince;
async function time(label, fn) {
    const start = process.hrtime.bigint();
    try {
        const result = await fn();
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1e6;
        return { result, ms };
    }
    finally {
        // no-op
    }
}
function msSince(startNs) {
    return Number(process.hrtime.bigint() - startNs) / 1e6;
}
//# sourceMappingURL=time.js.map