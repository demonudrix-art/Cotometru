package ro.drix.sbradar.trace;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

final class RouteStore {
    static final String PREF = "golden_trace_private";
    static final String BACKEND = "https://ghost-equal-alert-v1.drix-beast-xray.workers.dev";
    static final String CHROME = "com.android.chrome";
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREF, Context.MODE_PRIVATE); }

    static final class Step {
        String action = "CLICK";
        String viewId = "", label = "", desc = "", klass = "";
        float x, y;
        String input = "";
        JSONObject json() throws Exception {
            JSONObject j = new JSONObject(); j.put("action", action); j.put("viewId", viewId);
            j.put("label", label); j.put("desc", desc); j.put("class", klass);
            j.put("x", (double)x); j.put("y", (double)y); j.put("input", input); return j;
        }
        static Step from(JSONObject j) {
            Step s = new Step(); s.action = j.optString("action", "CLICK");
            s.viewId = j.optString("viewId"); s.label = j.optString("label");
            s.desc = j.optString("desc"); s.klass = j.optString("class");
            s.x = (float)j.optDouble("x", 0); s.y = (float)j.optDouble("y", 0);
            s.input = j.optString("input"); return s;
        }
        String summary() { return action + " · " + (!label.isEmpty() ? label : !desc.isEmpty() ? desc : viewId); }
    }
    static void save(Context c, List<Step> steps) throws Exception {
        JSONArray a = new JSONArray(); for (Step s:steps) a.put(s.json());
        prefs(c).edit().putString("route", a.toString()).apply();
    }
    static List<Step> read(Context c) {
        List<Step> r = new ArrayList<>();
        try { JSONArray a = new JSONArray(prefs(c).getString("route", "[]"));
            for(int i=0;i<a.length();i++) r.add(Step.from(a.getJSONObject(i)));
        } catch(Exception ignored) { } return r;
    }
    static boolean isFinal(Step s) {
        String t = (s.label+" "+s.desc).toLowerCase(java.util.Locale.ROOT);
        return s.action.equals("CLICK") && (t.contains("pariaz") || t.contains("plaseaz")
                || t.contains("confirmă pari") || t.contains("confirma pari")
                || t.contains("place bet") || t.contains("place wager"));
    }
    static boolean hasX(List<Step> steps) {
        for(Step s:steps) if(s.action.equals("CLICK") &&
                (s.label.trim().equalsIgnoreCase("X") || s.desc.trim().equalsIgnoreCase("X")
                        || s.label.matches("(?is)^X\\s+[0-9]+[.,][0-9]+$"))) return true;
        return false;
    }
    static boolean isComplete(List<Step> steps) {
        if(steps.size()<2 || steps.size()>25 || !hasX(steps))return false;
        boolean stake=false;
        for(Step s:steps)if("SET_STAKE".equals(s.action))stake=true;
        return stake && isFinal(steps.get(steps.size()-1));
    }
    static Step capture(AccessibilityNodeInfo node, android.util.DisplayMetrics dm, String action) {
        Step s = new Step(); s.action=action;
        if(node==null)return s;
        s.viewId = clean(node.getViewIdResourceName());
        s.label = clean(node.getText());
        s.desc = clean(node.getContentDescription());
        s.klass = clean(node.getClassName());
        Rect rect = new Rect(); node.getBoundsInScreen(rect);
        s.x = dm.widthPixels==0?0:((float)rect.centerX())/dm.widthPixels;
        s.y = dm.heightPixels==0?0:((float)rect.centerY())/dm.heightPixels;
        return s;
    }
    static String clean(CharSequence s) {
        if(s==null)return "";
        String t=s.toString().replaceAll("[\\r\\n]+", " ").trim();
        return t.length()>160?t.substring(0,160):t;
    }
}
