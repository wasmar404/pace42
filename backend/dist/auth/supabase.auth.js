"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.getSupabaseAdminClient = getSupabaseAdminClient;
const supabase_js_1 = require("@supabase/supabase-js");
exports.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
let _admin = null;
function getSupabaseAdminClient() {
    if (_admin)
        return _admin;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    _admin = (0, supabase_js_1.createClient)(url, key);
    return _admin;
}
//# sourceMappingURL=supabase.auth.js.map