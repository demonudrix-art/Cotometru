package ro.cotometru.beastcompanion;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.app.KeyguardManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.TextView;
import org.json.JSONObject;

public final class TapService extends AccessibilityService {
  static volatile TapService active;
  static final String PREFS="tap_settings";
  private final Handler main=new Handler(Looper.getMainLooper());
  private WindowManager manager;
  private TextView bubble;
  private WindowManager.LayoutParams layout;
  private boolean busy=false;
  private long gestureToken=0;

  static boolean hasTarget(Context c) {
    return c.getSharedPreferences(PREFS,MODE_PRIVATE).getBoolean("has_target",false);
  }
  static boolean enabled(Context c) {
    return c.getSharedPreferences(PREFS,MODE_PRIVATE).getBoolean("enabled",true);
  }
  static void record(Context c,String state,String eventId,long delayMs) {
    c.getSharedPreferences("events",MODE_PRIVATE).edit()
      .putString("tap_state",state).putString("tap_event",eventId)
      .putLong("tap_delay_ms",delayMs).putLong("tap_when",System.currentTimeMillis()).apply();
  }
  static void onGoalSse(Context c,JSONObject e,long receivedNs) {
    final String eventId=e.optString("eventId","")+"#"+e.optInt("goalNumber",-1);
    TapService service=active;
    if(service==null) {record(c,"SERVICIU ACCESIBILITATE DEZACTIVAT",eventId,0);return;}
    service.main.post(()->service.dispatchAutoTap(eventId,receivedNs));
  }
  @Override protected void onServiceConnected() {
    super.onServiceConnected();
    active=this;
    manager=(WindowManager)getSystemService(WINDOW_SERVICE);
    record(this,"Accesibilitate activă. Poziționează bula BEAST.", "",0);
  }
  @Override public void onAccessibilityEvent(AccessibilityEvent e) {}
  @Override public void onInterrupt() {}
  void toggle() {
    main.post(()->{if(bubble==null)showBubble();else hideBubble();});
  }
  void manualTap() {
    main.post(()->dispatchAtTarget("MANUAL",SystemClock.elapsedRealtimeNanos(),false));
  }
  private void showBubble() {
    if(manager==null||bubble!=null)return;
    bubble=new TextView(this);
    bubble.setText("◎ BEAST\nȚINTĂ");
    bubble.setTextColor(Color.BLACK);
    bubble.setTextSize(12);
    bubble.setGravity(Gravity.CENTER);
    bubble.setBackgroundColor(Color.rgb(178,255,135));
    final int side=(int)(72*getResources().getDisplayMetrics().density);
    layout=new WindowManager.LayoutParams(side,side,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT);
    layout.gravity=Gravity.TOP|Gravity.LEFT;
    layout.x=getSharedPreferences(PREFS,MODE_PRIVATE).getInt("overlay_x",65);
    layout.y=getSharedPreferences(PREFS,MODE_PRIVATE).getInt("overlay_y",290);
    bubble.setOnTouchListener(new View.OnTouchListener() {
      int x0,y0;float rawX,rawY;long start;boolean moved=false;
      @Override public boolean onTouch(View v,MotionEvent e){
        switch(e.getActionMasked()){
          case MotionEvent.ACTION_DOWN:
            x0=layout.x;y0=layout.y;rawX=e.getRawX();rawY=e.getRawY();
            start=SystemClock.uptimeMillis();moved=false;return true;
          case MotionEvent.ACTION_MOVE:
            if(Math.abs(e.getRawX()-rawX)>10||Math.abs(e.getRawY()-rawY)>10)moved=true;
            if(moved&&manager!=null){
              layout.x=x0+Math.round(e.getRawX()-rawX);
              layout.y=y0+Math.round(e.getRawY()-rawY);
              try{manager.updateViewLayout(bubble,layout);}catch(Exception ignored){}
            }
            return true;
          case MotionEvent.ACTION_UP:
            saveTarget();
            if(!moved&&SystemClock.uptimeMillis()-start<650)manualTap();
            return true;
          default:return true;
        }
      }
    });
    try{manager.addView(bubble,layout);}catch(Exception e){bubble=null;record(this,"EROARE BULĂ: "+e.getClass().getSimpleName(),"",0);}
  }
  private void saveTarget() {
    if(bubble==null||layout==null)return;
    int[] location=new int[2];
    bubble.getLocationOnScreen(location);
    int x=location[0]+bubble.getWidth()/2;
    int y=location[1]+bubble.getHeight()/2;
    getSharedPreferences(PREFS,MODE_PRIVATE).edit()
      .putBoolean("has_target",true).putInt("x",x).putInt("y",y)
      .putInt("overlay_x",layout.x).putInt("overlay_y",layout.y).apply();
    record(this,"Țintă salvată la x="+x+", y="+y,"",0);
  }
  private void hideBubble() {
    if(bubble!=null&&manager!=null){
      saveTarget();
      if(bubble.getParent()!=null)try{manager.removeViewImmediate(bubble);}catch(Exception ignored){}
      bubble=null;
    }
  }
  private void dispatchAutoTap(String id,long receivedNs){
    if(!enabled(this)){record(this,"AUTO OPRIT",id,0);return;}
    dispatchAtTarget(id,receivedNs,true);
  }
  private void dispatchAtTarget(String id,long receivedNs,boolean auto){
    if(busy){record(this,"OCUPAT (gest în desfășurare)",id,0);return;}
    if(!hasTarget(this)){record(this,"NU EXISTĂ ȚINTĂ: mută bula BEAST",id,0);return;}
    PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);
    KeyguardManager km=(KeyguardManager)getSystemService(KEYGUARD_SERVICE);
    if(pm==null||!pm.isInteractive()||(km!=null&&km.isKeyguardLocked())){
      record(this,"ECRAN BLOCAT / INACTIV",id,0);return;
    }
    int x=getSharedPreferences(PREFS,MODE_PRIVATE).getInt("x",-1);
    int y=getSharedPreferences(PREFS,MODE_PRIVATE).getInt("y",-1);
    if(x<0||y<0){record(this,"COORDONATE INVALIDE",id,0);return;}
    busy=true;final long token=++gestureToken;
    final TextView restore=bubble;
    final boolean reAdd=restore!=null && restore.getParent()!=null;
    if(reAdd)try{manager.removeViewImmediate(restore);}catch(Exception ignored){}
    final int targetX=x,targetY=y;
    // One display frame lets Android remove the overlay before injecting the tap.
    main.postDelayed(()->{
      if(token!=gestureToken||!busy)return;
      final long delayMs=Math.max(0,(SystemClock.elapsedRealtimeNanos()-receivedNs)/1000000L);
      Path path=new Path();path.moveTo(targetX,targetY);
      GestureDescription g=new GestureDescription.Builder()
        .addStroke(new GestureDescription.StrokeDescription(path,0,45)).build();
      boolean accepted=dispatchGesture(g,new GestureResultCallback(){
        @Override public void onCompleted(GestureDescription gesture){
          finishTap(token,restore,reAdd,"GEST EXECUTAT x="+targetX+" y="+targetY,id,delayMs);
        }
        @Override public void onCancelled(GestureDescription gesture){
          finishTap(token,restore,reAdd,"GEST ANULAT",id,delayMs);
        }
      },main);
      if(accepted){
        record(TapService.this,(auto?"AUTO ":"MANUAL ")+"ATINGERE TRIMISĂ x="+targetX+" y="+targetY,id,delayMs);
      }else{
        finishTap(token,restore,reAdd,"GEST RESPINS DE ANDROID",id,delayMs);
      }
      main.postDelayed(()->{if(busy&&token==gestureToken)finishTap(token,restore,reAdd,"GEST FĂRĂ CONFIRMARE",id,delayMs);},1300);
    },24);
  }
  private void finishTap(long token,TextView restore,boolean reAdd,String status,String id,long delayMs){
    if(token!=gestureToken||!busy)return;
    busy=false;
    record(this,status,id,delayMs);
    if(reAdd&&bubble==restore&&manager!=null&&restore.getParent()==null){
      try{manager.addView(restore,layout);}catch(Exception e){bubble=null;}
    }
  }
  @Override public void onDestroy(){
    gestureToken++;
    busy=false;
    hideBubble();
    active=null;
    super.onDestroy();
  }
}
