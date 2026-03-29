"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupabaseForRequest = createSupabaseForRequest;
exports.readBearerFromHeaders = readBearerFromHeaders;
const supabase_js_1 = require("@supabase/supabase-js");
function createSupabaseForRequest(params) {
    const accessToken = params.req?.supabaseAuth?.accessToken;
    if (!accessToken) {
        return (0, supabase_js_1.createClient)(params.supabaseUrl, params.supabaseAnonKey);
    }
    return (0, supabase_js_1.createClient)(params.supabaseUrl, params.supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    });
}
function readBearerFromHeaders(req) {
    const header = (req.headers?.authorization ?? req.headers?.Authorization);
    if (!header)
        return null;
    const [kind, token] = header.split(' ');
    if (kind !== 'Bearer' || !token)
        return null;
    return token;
}
//# sourceMappingURL=supabase.request.js.map