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
        String viewId = "", label = "", desc = "", klass = "", diagnostic = "";
        boolean visualX=false;
        double visualOdds=0;
        float x, y, endX, endY;
        long durationMs=0;
        String input = "";
        JSONObject json() throws Exception {
            JSONObject j = new JSONObject(); j.put("action", action); j.put("viewId", viewId);
            j.put("label", label); j.put("desc", desc); j.put("class", klass); j.put("diagnostic", diagnostic);
            j.put("visualX",visualX);j.put("visualOdds",visualOdds);
            j.put("x", (double)x); j.put("y", (double)y);
            j.put("endX", (double)endX); j.put("endY", (double)endY);
            j.put("durationMs",durationMs); j.put("input", input); return j;
        }
        static Step from(JSONObject j) {
            Step s = new Step(); s.action = j.optString("action", "CLICK");
            s.viewId = j.optString("viewId"); s.label = j.optString("label");
            s.desc = j.optString("desc"); s.klass = j.optString("class"); s.diagnostic=j.optString("diagnostic","");
            s.visualX=j.optBoolean("visualX",false);
            s.visualOdds=j.optDouble("visualOdds",0);
            s.x = (float)j.optDouble("x", 0); s.y = (float)j.optDouble("y", 0);
            s.endX=(float)j.optDouble("endX",s.x);s.endY=(float)j.optDouble("endY",s.y);
            s.durationMs=j.optLong("durationMs",0);
            s.input = j.optString("input"); return s;
        }
        String summary() { return action + " · " + (!label.isEmpty() ? label : !desc.isEmpty() ? desc : !viewId.isEmpty()?viewId:"atingere la "+Math.round(x*100)+"%, "+Math.round(y*100)+"%") +
                (visualX?" [X VIZUAL OCR · "+String.format(java.util.Locale.US,"%.2f",visualOdds)+"]":""); }
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
    static boolean hasVisualX(List<Step> steps){
        for(Step s:steps)
            if("CLICK".equals(s.action)&&s.visualX&&s.visualOdds>1.0&&s.visualOdds<1000.0)
                return true;
        return false;
    }
    static boolean hasEditableStake(List<Step> steps){
        for(Step s:steps)
            if("SET_STAKE".equals(s.action)&&(!s.viewId.isEmpty() ||
                !s.klass.isEmpty() || !s.desc.isEmpty()))return true;
        return false;
    }
    static String missingReasons(List<Step> steps){
        List<String> missing=new ArrayList<>();
        if(steps.isEmpty())return "Niciun pas înregistrat";
        if(!hasX(steps))missing.add(hasVisualX(steps)?
            "X identificat vizual prin OCR; selectorul Accessibility nu este încă validat pentru redare":
            "selectarea X nu a fost identificată");
        boolean unknown=false;
        for(Step st:steps)if("TAP_COORD".equals(st.action))unknown=true;
        if(!hasEditableStake(steps))missing.add("câmpul mizei nu a fost recunoscut ca editabil");
        if(!isFinal(steps.get(steps.size()-1)))
            missing.add("ultimul pas nu este butonul final Pariază");
        if(unknown)missing.add("există atingeri fără identificator (nu se pot reproduce sigur)");
        if(steps.size()>25)missing.add("prea mulți pași");
        return missing.isEmpty()?"Toate etapele identificabile au fost capturate":
            String.join("; ",missing);
    }
    static boolean isComplete(List<Step> steps) {
        return steps.size()>=2 && steps.size()<=25 &&
               "Toate etapele identificabile au fost capturate".equals(missingReasons(steps));
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
