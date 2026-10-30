package ro.drix.sbradar.trace;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.app.KeyguardManager;
import android.os.PowerManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class GoldenAccessibility extends AccessibilityService {
    static volatile GoldenAccessibility instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<RouteStore.Step> recording = new ArrayList<>();
    private boolean rec=false, playing=false, finalClickDone=false, simulation=false;
    private List<RouteStore.Step> route;
    private GoldenMonitor.Signal active;
    private int index=0, tries=0;
    private boolean xSelected=false, stakeSet=false;
    private double observedX=0;
    private long lastEventAt=0, replayStartedAt=0;
    private String lastClickKey="";

    @Override protected void onServiceConnected(){
        super.onServiceConnected(); instance=this;
        if(RouteStore.prefs(this).getBoolean("rec_active",false)){
            recording.clear(); recording.addAll(RouteStore.read(this));
            rec=true;
            status("REC restaurat · "+recording.size()+" pași salvați");
        }else status("Accesibilitate activă");
    }
    @Override public void onInterrupt(){ abort("Serviciul Android a fost întrerupt"); }
    @Override public void onDestroy(){ if(instance==this)instance=null; abort("Serviciu închis"); super.onDestroy(); }
    static String statusText(android.content.Context c){return RouteStore.prefs(c).getString("status","Neconfigurat");}
    void status(String text){ RouteStore.prefs(this).edit().putString("status",text).apply(); }

    void beginRecording(String startingUrl){
        if(playing){status("Oprește redarea înainte de înregistrare");return;}
        if(!startingUrl.startsWith("https://superbet.ro/")){
            status("REC nu a pornit: URL trebuie să înceapă cu https://superbet.ro/");
            return;
        }
        recording.clear();lastClickKey="";rec=true;
        try{RouteStore.save(this,recording);}
        catch(Exception e){status("Nu pot inițializa fișierul traseului: "+e.getMessage());rec=false;return;}
        RouteStore.prefs(this).edit()
            .putBoolean("rec_active",true)
            .putInt("rec_chrome_events",0).putInt("rec_clicks",0)
            .putInt("rec_text_edits",0).putInt("rec_unlabelled",0)
            .putString("rec_last_package","-").putString("rec_last_type","-").apply();
        status("● REC ACTIV · Chrome este monitorizat; atinge X și câmpul mizei");
        openChrome(startingUrl);
    }
    void endRecording(){
        rec=false;
        RouteStore.prefs(this).edit().putBoolean("rec_active",false).apply();
        List<RouteStore.Step> saved=RouteStore.read(this);
        if(saved.size()>recording.size()){recording.clear();recording.addAll(saved);}
        try {
            RouteStore.save(this,recording);
            status("Traseu salvat: "+recording.size()+" pași · "+
                (RouteStore.isComplete(recording)?"COMPLET":"INCOMPLET")+
                " · Chrome evenimente "+RouteStore.prefs(this).getInt("rec_chrome_events",0));
        }catch(Exception e){status("Eroare salvare traseu: "+e.getMessage());}
    }
    void abort(String why){
        rec=false;playing=false;active=null;
        RouteStore.prefs(this).edit().putBoolean("rec_active",false).apply();
        status("STOP · "+why);
    }
    boolean isRecording(){return rec;}

    @Override public void onAccessibilityEvent(AccessibilityEvent ev){
        if(ev==null)return;
        if(!rec && RouteStore.prefs(this).getBoolean("rec_active",false)){
            rec=true;recording.clear();recording.addAll(RouteStore.read(this));
        }
        if(!rec)return;
        String pkg=ev.getPackageName()==null?"(fără pachet)":ev.getPackageName().toString();
        int type=ev.getEventType();
        if(type==AccessibilityEvent.TYPE_VIEW_CLICKED || type==AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED){
            RouteStore.prefs(this).edit().putString("rec_last_package",pkg)
                .putString("rec_last_type",type==AccessibilityEvent.TYPE_VIEW_CLICKED?"CLICK":"TEXT").apply();
        }
        if(!RouteStore.CHROME.equals(pkg))return;
        if(type==AccessibilityEvent.TYPE_VIEW_CLICKED || type==AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED){
            RouteStore.prefs(this).edit()
                .putInt("rec_chrome_events",RouteStore.prefs(this).getInt("rec_chrome_events",0)+1)
                .apply();
            if(type==AccessibilityEvent.TYPE_VIEW_CLICKED)recordClick(ev);
            else recordNumericEdit(ev);
        }
    }
    private static String eventLabel(AccessibilityEvent ev){
        StringBuilder sb=new StringBuilder();
        if(ev.getText()!=null)for(CharSequence t:ev.getText()){
            if(t!=null && sb.length()<140)sb.append(t).append(' ');
        }
        return RouteStore.clean(sb);
    }
    private static String descendantText(AccessibilityNodeInfo n){
        if(n==null)return "";
        StringBuilder sb=new StringBuilder();
        List<AccessibilityNodeInfo> q=new ArrayList<>();q.add(n);
        for(int i=0;i<q.size()&&i<20;i++){
            AccessibilityNodeInfo item=q.get(i);
            String t=RouteStore.clean(item.getText());
            if(!t.isEmpty()&&sb.indexOf(t)<0)sb.append(t).append(' ');
            for(int j=0;j<item.getChildCount()&&j<8;j++){
                AccessibilityNodeInfo c=item.getChild(j);if(c!=null)q.add(c);
            }
        }
        return RouteStore.clean(sb);
    }
    private void saveProgress(){
        try{RouteStore.save(this,recording);}
        catch(Exception e){status("REC eroare de scriere: "+e.getMessage());}
    }
    private void recordClick(AccessibilityEvent ev){
        RouteStore.prefs(this).edit().putInt("rec_clicks",RouteStore.prefs(this).getInt("rec_clicks",0)+1).apply();
        AccessibilityNodeInfo src=ev.getSource();
        RouteStore.Step step=RouteStore.capture(src,getResources().getDisplayMetrics(),"CLICK");
        if(step.label.isEmpty())step.label=eventLabel(ev);
        if(step.desc.isEmpty())step.desc=RouteStore.clean(ev.getContentDescription());
        if(step.label.isEmpty())step.label=descendantText(src);
        if(step.label.isEmpty()&&step.desc.isEmpty()&&step.viewId.isEmpty()){
            RouteStore.prefs(this).edit().putInt("rec_unlabelled",RouteStore.prefs(this).getInt("rec_unlabelled",0)+1).apply();
            step.label="[click fără etichetă — nu poate fi redat automat]";
        }
        String key=step.viewId+"|"+step.label+"|"+step.desc;
        long now=android.os.SystemClock.elapsedRealtime();
        if(now-lastEventAt<350&&key.equals(lastClickKey))return;
        lastEventAt=now;lastClickKey=key;
        if(recording.size()>=25){
            rec=false;RouteStore.prefs(this).edit().putBoolean("rec_active",false).apply();
            status("REC oprit · maxim 25 pași");return;
        }
        recording.add(step);saveProgress();
        status("● REC "+recording.size()+" pași · "+step.summary());
    }
    private void recordNumericEdit(AccessibilityEvent ev){
        AccessibilityNodeInfo src=ev.getSource();if(src==null || src.isPassword())return;
        RouteStore.Step step=RouteStore.capture(src,getResources().getDisplayMetrics(),"SET_STAKE");
        String value=step.label.replace(' ', '\u0000').replace("\u0000", "");
        if(!value.matches("[0-9]{1,4}([.,][0-9]{1,2})?"))return;
        step.input=value;
        // Consecutive character edits to the same input are one route step.
        if(!recording.isEmpty()){
            RouteStore.Step prev=recording.get(recording.size()-1);
            if(prev.action.equals("SET_STAKE") && (prev.viewId.equals(step.viewId)||
                  Math.abs(prev.x-step.x)<.02f && Math.abs(prev.y-step.y)<.02f)) {
                recording.set(recording.size()-1,step);saveProgress();status("REC miză: "+value);return;
            }
        }
        if(recording.size()<25){
            recording.add(step);saveProgress();
            RouteStore.prefs(this).edit().putInt("rec_text_edits",RouteStore.prefs(this).getInt("rec_text_edits",0)+1).apply();
            status("REC câmp miză: "+value);
        }
    }
    private void openChrome(String url){
        try {
            if(!url.startsWith("https://superbet.ro/"))throw new SecurityException("Domeniu neacceptat");
            Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse(url));i.setPackage(RouteStore.CHROME);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);startActivity(i);
        }catch(Exception e){status("Chrome nu a pornit: "+e.getMessage());}
    }

    static boolean replay(GoldenMonitor.Signal sig, boolean dryRun){
        GoldenAccessibility s=instance;
        if(s==null)return false;
        s.handler.post(()->s.startReplay(sig,dryRun));return true;
    }
    private boolean awake(){
        KeyguardManager k=(KeyguardManager)getSystemService(KEYGUARD_SERVICE);
        PowerManager p=(PowerManager)getSystemService(POWER_SERVICE);
        return p!=null&&p.isInteractive()&&k!=null&&!k.isDeviceLocked()&&!k.isKeyguardLocked();
    }
    private void startReplay(GoldenMonitor.Signal sig, boolean dryRun){
        if(rec||playing){status("Replay refuzat: alt traseu activ");return;}
        route=RouteStore.read(this);
        if(!RouteStore.isComplete(route)){status("Replay refuzat: traseul nu conține X + confirmarea finală");return;}
        if(!awake()){status("Golden Ticket primit · telefonul este blocat/stins; deschide notificarea");return;}
        if(!dryRun && (!RouteStore.prefs(this).getBoolean("real",false) ||
              RouteStore.prefs(this).getInt("stake",0)<=0)){
            status("Golden Ticket primit · execuția reală nu este armată / miză lipsă");return;
        }
        if(sig==null||!sig.valid()||!sig.url.startsWith("https://superbet.ro/cote/fotbal/")){
            status("Replay refuzat: semnal sau URL neverificat");return;
        }
        this.active=sig;this.simulation=dryRun;this.playing=true;this.finalClickDone=false;
        index=0;tries=0;xSelected=false;stakeSet=false;observedX=0;replayStartedAt=android.os.SystemClock.elapsedRealtime();
        status("Golden Ticket "+sig.eventId+" · deschid Chrome"+(dryRun?" · SIMULARE":""));
        openChrome(sig.url);handler.postDelayed(runNext,1800);
    }
    private final Runnable runNext=new Runnable(){@Override public void run(){proceed();}};
    private void proceed(){
        if(!playing)return;
        if(!awake()){abort("Telefon blocat / ecran stins în timpul traseului");return;}
        if(android.os.SystemClock.elapsedRealtime()-replayStartedAt>45000L){abort("Timeout 45 secunde");return;}
        AccessibilityNodeInfo root=getRootInActiveWindow();
        if(root==null||!RouteStore.CHROME.contentEquals(root.getPackageName())){retry("Chrome nu este în prim-plan");return;}
        if(index>=route.size()){playing=false;status(finalClickDone?"CLICK FINAL TRIMIS (acceptarea pariului NU este confirmată)":"Simulare încheiată");return;}
        RouteStore.Step step=route.get(index);
        if(index==route.size()-1 && !RouteStore.isFinal(step)){abort("Ultimul pas nu este butonul de plasare");return;}
        if(index==route.size()-1 && !matchFixture(root,active)){abort("Nu pot confirma echipele pe pagina meciului");return;}
        if(index==route.size()-1 && (!xSelected || !stakeSet || observedX < active.x-.03 || observedX > active.x+.30 || !isStakeVisible(root))){
            abort("Ultima verificare a eșuat: X/miză/cotă neconfirmate · STOP");return;
        }
        AccessibilityNodeInfo found=findUnique(root,step);
        if(found==null){retry("Nu găsesc pasul "+(index+1)+" · "+step.summary());return;}
        if(step.action.equals("SET_STAKE")){
            int lei=RouteStore.prefs(this).getInt("stake",0);
            int max=RouteStore.prefs(this).getInt("max_stake",50);
            if(lei<=0||lei>max){abort("Miza "+lei+" depășește plafonul "+max);return;}
            Bundle b=new Bundle();b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,String.valueOf(lei));
            if(!found.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,b)){retry("Câmpul mizei nu acceptă introducerea");return;}
            stakeSet=true;
        }else{
            if(index==route.size()-1){
                if(simulation){playing=false;status("SIMULARE OK · înainte de ultimul click · fără miză reală");return;}
                if(finalClickDone){abort("Click final deja executat, fără retry");return;}
                finalClickDone=true; // Once, before dispatch. Never retry the money action.
            }
            AccessibilityNodeInfo clickable=found;
            while(clickable!=null&&!clickable.isClickable())clickable=clickable.getParent();
            if(clickable==null){abort("Pas fără control clickabil (fără tap orb)");return;}
            if(step.label.trim().equalsIgnoreCase("X") || step.desc.trim().equalsIgnoreCase("X") ||
                    step.label.matches("(?is)^X\\s+[0-9]+[.,][0-9]+$")){
                // Price must be obtainable from the selected market control, not guessed from a cached signal.
                observedX=priceFromControl(found);
                if(observedX<=0){abort("Cota X nu este accesibilă în pagina Chrome; fără click orb");return;}
                xSelected=true;
            }
            if(!clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)){
                if(finalClickDone){abort("Click final neconfirmat; NU reîncerc");return;}
                retry("Apăsarea nereușită la pasul "+(index+1));return;
            }
        }
        status("Traseu: "+(index+1)+"/"+route.size()+" · "+step.summary());
        index++;tries=0;
        handler.postDelayed(runNext,850);
    }
    private void retry(String message){
        if(++tries>=8){abort(message+" · STOP");return;}
        status(message+" · reîncerc "+tries+"/8");handler.postDelayed(runNext,650);
    }
    private AccessibilityNodeInfo findUnique(AccessibilityNodeInfo root,RouteStore.Step step){
        List<AccessibilityNodeInfo> nodes=new ArrayList<>();nodes.add(root);
        AccessibilityNodeInfo exact=null;int count=0;
        for(int i=0;i<nodes.size()&&i<1200;i++){
            AccessibilityNodeInfo n=nodes.get(i);
            String label=RouteStore.clean(n.getText()),desc=RouteStore.clean(n.getContentDescription());
            String id=n.getViewIdResourceName()==null?"":n.getViewIdResourceName();
            boolean hit=false;
            if(!step.viewId.isEmpty()&&id.equals(step.viewId))hit=true;
            else if(!step.label.isEmpty()&&label.equalsIgnoreCase(step.label))hit=true;
            else if(!step.desc.isEmpty()&&desc.equalsIgnoreCase(step.desc))hit=true;
            else if(step.label.matches("(?i)^X\\s*[0-9]+[.,][0-9]+$") &&
                    label.matches("(?i)^X\\s*[0-9]+[.,][0-9]+$"))hit=true;
            if(hit){exact=n;count++;}
            for(int j=0;j<n.getChildCount();j++){AccessibilityNodeInfo c=n.getChild(j);if(c!=null)nodes.add(c);}
        }
        // Ambiguous selectors MUST NOT click, especially for X and final placement.
        return count==1?exact:null;
    }
    private double priceFromControl(AccessibilityNodeInfo node){
        // Use only a single unambiguous price beside the selected X, not arbitrary page prices.
        for(int up=0;up<2&&node!=null;up++,node=node.getParent()){
            StringBuilder sb=new StringBuilder(RouteStore.clean(node.getText())).append(' ').append(RouteStore.clean(node.getContentDescription()));
            for(int i=0;i<node.getChildCount()&&i<6;i++){
                AccessibilityNodeInfo c=node.getChild(i);
                if(c!=null)sb.append(' ').append(RouteStore.clean(c.getText()));
            }
            java.util.regex.Matcher m=java.util.regex.Pattern.compile("(?<![0-9])[1-9][0-9]?[.,][0-9]{2,3}(?![0-9])").matcher(sb);
            double value=0;int count=0;
            while(m.find()){value=Double.parseDouble(m.group().replace(',','.'));count++;}
            if(count==1)return value;
        }
        return 0;
    }
    private boolean isStakeVisible(AccessibilityNodeInfo root){
        String expected=String.valueOf(RouteStore.prefs(this).getInt("stake",0));
        List<AccessibilityNodeInfo> nodes=new ArrayList<>();nodes.add(root);
        for(int i=0;i<nodes.size()&&i<1200;i++){
            AccessibilityNodeInfo n=nodes.get(i);
            if(n.getClassName()!=null&&n.getClassName().toString().contains("EditText") &&
                    expected.equals(RouteStore.clean(n.getText())))return true;
            for(int j=0;j<n.getChildCount();j++){AccessibilityNodeInfo c=n.getChild(j);if(c!=null)nodes.add(c);}
        }
        return false;
    }
    private boolean matchFixture(AccessibilityNodeInfo root,GoldenMonitor.Signal sig){
        StringBuilder sb=new StringBuilder();List<AccessibilityNodeInfo> nodes=new ArrayList<>();nodes.add(root);
        for(int i=0;i<nodes.size()&&i<850;i++){
            AccessibilityNodeInfo n=nodes.get(i);if(n.getText()!=null)sb.append(' ').append(n.getText());
            for(int j=0;j<n.getChildCount();j++){AccessibilityNodeInfo c=n.getChild(j);if(c!=null)nodes.add(c);}
        }
        String text=fold(sb.toString());
        return sig.home.length()>=3&&sig.away.length()>=3&&text.contains(fold(sig.home))&&text.contains(fold(sig.away));
    }
    private String fold(String x){
        return java.text.Normalizer.normalize(x,java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}","").toLowerCase(Locale.ROOT);
    }
}
