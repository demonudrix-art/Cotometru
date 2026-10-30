package ro.drix.sbradar.trace;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.view.accessibility.AccessibilityWindowInfo;
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
    private WindowManager overlayManager;
    private View touchOverlay;
    private boolean overlayVisible=false,touchForwarding=false;
    private long overlayDownAt=0,ignoreNativeClickUntil=0;
    private float touchStartX=0,touchStartY=0;

    @Override protected void onServiceConnected(){
        super.onServiceConnected(); instance=this;
        overlayManager=(WindowManager)getSystemService(WINDOW_SERVICE);
        if(RouteStore.prefs(this).getBoolean("rec_active",false)){
            recording.clear(); recording.addAll(RouteStore.read(this));
            rec=true;
            status("REC restaurat · "+recording.size()+" pași salvați");
        }else status("Accesibilitate activă");
    }
    @Override public void onInterrupt(){
        if(playing)abort("Serviciul Android a fost întrerupt în timpul redării");
        else if(rec)status("REC temporar întrerupt · traseul salvat se păstrează");
    }
    @Override public void onDestroy(){
        removeTouchOverlay();
        if(instance==this)instance=null;
        playing=false;active=null;rec=false;
        if(RouteStore.prefs(this).getBoolean("rec_active",false))
            status("REC suspendat de Android · pașii salvați se păstrează");
        super.onDestroy();
    }
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
            .putInt("rec_chrome_windows",0)
            .putInt("rec_overlay_taps",0).putInt("rec_overlay_swipes",0).putInt("rec_forward_failed",0)
            .putString("rec_last_package","-").putString("rec_last_type","-").apply();
        status("● REC ACTIV · Chrome este monitorizat; atinge X și câmpul mizei");
        openChrome(startingUrl);
        handler.postDelayed(this::syncTouchOverlay,900);
    }
    void endRecording(){
        rec=false;touchForwarding=false;removeTouchOverlay();
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
        rec=false;touchForwarding=false;removeTouchOverlay();playing=false;active=null;
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
        if(type==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
           type==AccessibilityEvent.TYPE_WINDOWS_CHANGED){
            handler.postDelayed(this::syncTouchOverlay,160);
        }
        if(!RouteStore.CHROME.equals(pkg))return;
        if(type==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            type==AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED){
            if(!overlayVisible)handler.postDelayed(this::syncTouchOverlay,220);
            int seen=RouteStore.prefs(this).getInt("rec_chrome_windows",0);
            if(seen<9999)RouteStore.prefs(this).edit().putInt("rec_chrome_windows",seen+1).apply();
        }
        if(type==AccessibilityEvent.TYPE_VIEW_CLICKED || type==AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED){
            RouteStore.prefs(this).edit()
                .putInt("rec_chrome_events",RouteStore.prefs(this).getInt("rec_chrome_events",0)+1)
                .apply();
            if(type==AccessibilityEvent.TYPE_VIEW_CLICKED){
                if(android.os.SystemClock.elapsedRealtime()>=ignoreNativeClickUntil)recordClick(ev);
            }
            else recordNumericEdit(ev);
        }
    }

    // Android Chrome often does not emit DOM click accessibility events.
    // During REC, a transparent Accessibility overlay captures touch gestures,
    // temporarily removes itself, and forwards each gesture to Chrome.
    private boolean keyboardVisible(){
        try{
            List<AccessibilityWindowInfo> windows=getWindows();
            if(windows!=null)for(AccessibilityWindowInfo w:windows)
                if(w!=null&&w.getType()==AccessibilityWindowInfo.TYPE_INPUT_METHOD)return true;
        }catch(Exception ignored){}
        return false;
    }
    private boolean chromeForeground(){
        AccessibilityNodeInfo r=getRootInActiveWindow();
        return r!=null&&RouteStore.CHROME.contentEquals(r.getPackageName());
    }
    private void syncTouchOverlay(){
        if(touchForwarding)return;
        if(!rec||!RouteStore.prefs(this).getBoolean("rec_active",false)||
                !chromeForeground()||keyboardVisible()){
            removeTouchOverlay();return;
        }
        if(overlayVisible)return;
        try{
            if(overlayManager==null)overlayManager=(WindowManager)getSystemService(WINDOW_SERVICE);
            FrameLayout full=new FrameLayout(this);
            full.setBackgroundColor(Color.TRANSPARENT);
            full.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            full.setOnTouchListener((view,event)->handleOverlayTouch(event));
            TextView badge=new TextView(this);
            badge.setText("● REC GOLDEN · atingeri capturate");
            badge.setTextSize(11);
            badge.setTextColor(Color.WHITE);
            badge.setPadding(10,3,10,3);
            badge.setBackgroundColor(0xbb8f1010);
            FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP|Gravity.CENTER_HORIZONTAL);
            full.addView(badge,lp);
            WindowManager.LayoutParams p=new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN|
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
            p.gravity=Gravity.TOP|Gravity.LEFT;
            overlayManager.addView(full,p);
            touchOverlay=full;overlayVisible=true;
            status("● REC TOUCH ACTIV · gesturile Chrome sunt capturate");
        }catch(Exception e){
            status("Overlay REC indisponibil: "+e.getClass().getSimpleName()+
                " "+(e.getMessage()==null?"":e.getMessage()));
            removeTouchOverlay();
        }
    }
    private void removeTouchOverlay(){
        if(touchOverlay!=null && overlayManager!=null){
            try{overlayManager.removeViewImmediate(touchOverlay);}catch(Exception ignored){}
        }
        touchOverlay=null;overlayVisible=false;
    }
    private boolean handleOverlayTouch(MotionEvent ev){
        if(!rec)return true;
        int a=ev.getActionMasked();
        if(a==MotionEvent.ACTION_DOWN){
            touchStartX=ev.getRawX();touchStartY=ev.getRawY();
            overlayDownAt=android.os.SystemClock.elapsedRealtime();return true;
        }
        if(a==MotionEvent.ACTION_UP){
            final float endX=ev.getRawX(),endY=ev.getRawY();
            final long duration=Math.max(60,Math.min(1200,
                 android.os.SystemClock.elapsedRealtime()-overlayDownAt));
            final float sx=touchStartX,sy=touchStartY;
            float distance=(float)Math.hypot(endX-sx,endY-sy);
            boolean swipe=distance>Math.max(35,getResources().getDisplayMetrics().density*28);
            if(swipe)captureSwipe(sx,sy,endX,endY,duration);
            else captureTouch(sx,sy);
            ignoreNativeClickUntil=android.os.SystemClock.elapsedRealtime()+550;
            touchForwarding=true;
            removeTouchOverlay();
            handler.postDelayed(()->forwardTouch(sx,sy,endX,endY,duration,swipe),90);
            return true;
        }
        return true;
    }
    private void forwardTouch(float sx,float sy,float ex,float ey,long duration,boolean swipe){
        if(!rec){touchForwarding=false;return;}
        Path path=new Path();path.moveTo(sx,sy);
        if(swipe)path.lineTo(ex,ey);
        else path.lineTo(sx+.1f,sy+.1f);
        GestureDescription.Builder b=new GestureDescription.Builder();
        b.addStroke(new GestureDescription.StrokeDescription(
            path,0,swipe?Math.max(200,Math.min(1100,duration)):65));
        boolean accepted=dispatchGesture(b.build(),new GestureResultCallback(){
            @Override public void onCompleted(GestureDescription gesture){
                touchForwarding=false;
                handler.postDelayed(GoldenAccessibility.this::syncTouchOverlay,300);
            }
            @Override public void onCancelled(GestureDescription gesture){
                RouteStore.prefs(GoldenAccessibility.this).edit().putInt(
                    "rec_forward_failed",RouteStore.prefs(GoldenAccessibility.this)
                        .getInt("rec_forward_failed",0)+1).apply();
                status("GEST ANULAT · verifică dacă apăsarea a ajuns în Chrome");
                touchForwarding=false;
                handler.postDelayed(GoldenAccessibility.this::syncTouchOverlay,300);
            }
        },null);
        if(!accepted){
            touchForwarding=false;
            status("Nu am putut trimite atingerea către Chrome");
            handler.postDelayed(this::syncTouchOverlay,300);
        }
    }
    private void captureSwipe(float sx,float sy,float ex,float ey,long duration){
        android.util.DisplayMetrics dm=getResources().getDisplayMetrics();
        RouteStore.Step step=new RouteStore.Step();
        step.action="SWIPE";step.label="derulare Chrome";
        step.x=sx/dm.widthPixels;step.y=sy/dm.heightPixels;
        step.endX=ex/dm.widthPixels;step.endY=ey/dm.heightPixels;
        step.durationMs=duration;recordTouchStep(step,false);
        RouteStore.prefs(this).edit().putInt("rec_overlay_swipes",
            RouteStore.prefs(this).getInt("rec_overlay_swipes",0)+1).apply();
    }
    private void captureTouch(float screenX,float screenY){
        RouteStore.Step step=new RouteStore.Step();
        step.action="CLICK";
        AccessibilityNodeInfo node=nodeAtTouch(screenX,screenY);
        if(node!=null){
            step=RouteStore.capture(node,getResources().getDisplayMetrics(),"CLICK");
            if(step.label.isEmpty())step.label=descendantText(node);
            if(step.label.isEmpty()&&node.getParent()!=null){
                AccessibilityNodeInfo p=node.getParent();
                String parentText=RouteStore.clean(p.getText());
                if(!parentText.isEmpty()&&parentText.length()<70)step.label=parentText;
            }
            if(node.isEditable()){
                // Stake values will be recorded from TYPE_VIEW_TEXT_CHANGED instead.
                RouteStore.prefs(this).edit().putInt("rec_overlay_taps",
                    RouteStore.prefs(this).getInt("rec_overlay_taps",0)+1).apply();
                status("REC · câmp editabil · introdu miza");
                return;
            }
        }
        android.util.DisplayMetrics dm=getResources().getDisplayMetrics();
        step.x=screenX/dm.widthPixels;step.y=screenY/dm.heightPixels;
        step.endX=step.x;step.endY=step.y;
        boolean identified=!step.viewId.isEmpty()||!step.label.isEmpty()||!step.desc.isEmpty();
        if(!identified){
            step.action="TAP_COORD";step.label="atingere fără identificator · doar diagnostic";
        }
        recordTouchStep(step,!identified);
        RouteStore.prefs(this).edit().putInt("rec_overlay_taps",
            RouteStore.prefs(this).getInt("rec_overlay_taps",0)+1).apply();
    }
    private AccessibilityNodeInfo nodeAtTouch(float x,float y){
        AccessibilityNodeInfo root=getRootInActiveWindow();
        if(root==null||!RouteStore.CHROME.contentEquals(root.getPackageName()))return null;
        List<AccessibilityNodeInfo> q=new ArrayList<>();q.add(root);
        AccessibilityNodeInfo best=null;
        long bestArea=Long.MAX_VALUE;
        for(int i=0;i<q.size()&&i<1300;i++){
            AccessibilityNodeInfo n=q.get(i);
            Rect rect=new Rect();n.getBoundsInScreen(rect);
            if(rect.contains((int)x,(int)y) && rect.width()>0&&rect.height()>0){
                String name=RouteStore.clean(n.getText())+" "+
                    RouteStore.clean(n.getContentDescription())+" "+
                    (n.getViewIdResourceName()==null?"":n.getViewIdResourceName());
                if(!name.trim().isEmpty() || n.isEditable()){
                    long area=(long)rect.width()*rect.height();
                    if(area<bestArea){best=n;bestArea=area;}
                }
            }
            for(int j=0;j<n.getChildCount();j++){
                AccessibilityNodeInfo c=n.getChild(j);if(c!=null)q.add(c);
            }
        }
        return best;
    }
    private void recordTouchStep(RouteStore.Step step,boolean unlabeled){
        if(recording.size()>=25){
            rec=false;RouteStore.prefs(this).edit().putBoolean("rec_active",false).apply();
            removeTouchOverlay();status("REC oprit · maxim 25 pași");return;
        }
        recording.add(step);saveProgress();
        if(unlabeled)RouteStore.prefs(this).edit().putInt("rec_unlabelled",
            RouteStore.prefs(this).getInt("rec_unlabelled",0)+1).apply();
        status("REC TOUCH "+recording.size()+" pași · "+step.summary());
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
        if(sig==null||!(dryRun?sig.validTest():sig.valid())||
             !sig.url.startsWith("https://superbet.ro/cote/fotbal/")){
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
        if("SWIPE".equals(step.action)){
            replaySwipe(step);return;
        }
        if("TAP_COORD".equals(step.action)){
            abort("Pas doar cu coordonate; identificarea butonului este necesară pentru redare sigură");return;
        }
        if(index==route.size()-1 && !RouteStore.isFinal(step)){abort("Ultimul pas nu este butonul de plasare");return;}
        if(index==route.size()-1 && !matchFixture(root,active)){abort("Nu pot confirma echipele pe pagina meciului");return;}
        if(index==route.size()-1 && (!xSelected || !stakeSet ||
            (!simulation && (observedX < active.x-.03 ||
             observedX > active.x+.30 || !isStakeVisible(root))))){
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
                if(simulation){playing=false;status("⚡ TEST GOLDEN · X și miza procesate; OPRIT înainte de clickul final · nicio miză plasată");return;}
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
                if(observedX<=0&&!simulation){abort("Cota X nu este accesibilă în pagina Chrome; fără click orb");return;}
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
    private void replaySwipe(RouteStore.Step step){
        android.util.DisplayMetrics dm=getResources().getDisplayMetrics();
        float x1=step.x*dm.widthPixels,y1=step.y*dm.heightPixels;
        float x2=step.endX*dm.widthPixels,y2=step.endY*dm.heightPixels;
        if(x1<0||x1>dm.widthPixels||x2<0||x2>dm.widthPixels||
                y1<0||y1>dm.heightPixels||y2<0||y2>dm.heightPixels){
            abort("Derulare invalidă");return;
        }
        Path path=new Path();path.moveTo(x1,y1);path.lineTo(x2,y2);
        GestureDescription.Builder b=new GestureDescription.Builder();
        b.addStroke(new GestureDescription.StrokeDescription(path,0,
            Math.max(200,Math.min(1100,step.durationMs>0?step.durationMs:350))));
        boolean ok=dispatchGesture(b.build(),new GestureResultCallback(){
            @Override public void onCompleted(GestureDescription gesture){
                index++;tries=0;handler.postDelayed(runNext,650);
            }
            @Override public void onCancelled(GestureDescription gesture){
                abort("Derularea a fost anulată");
            }
        },null);
        if(!ok)abort("Nu pot reproduce derularea");
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
