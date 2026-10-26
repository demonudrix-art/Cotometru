package ro.cotometru.beastcompanion;
import android.accessibilityservice.*;
import android.graphics.*;
import android.os.*;
import android.view.*;
import android.view.accessibility.AccessibilityEvent;
import android.widget.TextView;

public final class TapService extends AccessibilityService {
  static volatile TapService active;
  private WindowManager wm;
  private TextView bubble;
  private WindowManager.LayoutParams position;
  private final Handler handler=new Handler(Looper.getMainLooper());
  @Override protected void onServiceConnected(){
    super.onServiceConnected();active=this;wm=(WindowManager)getSystemService(WINDOW_SERVICE);
  }
  @Override public void onAccessibilityEvent(AccessibilityEvent event){}
  @Override public void onInterrupt(){}
  void toggle(){handler.post(()->{if(bubble==null)showBubble();else hideBubble();});}
  private void showBubble(){
    if(wm==null||bubble!=null)return;
    bubble=new TextView(this);bubble.setText("◎ BEAST\nTEST");bubble.setTextSize(12);
    bubble.setTextColor(Color.BLACK);bubble.setBackgroundColor(Color.rgb(178,255,135));
    bubble.setGravity(Gravity.CENTER);
    int side=(int)(72*getResources().getDisplayMetrics().density);
    position=new WindowManager.LayoutParams(side,side,WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,PixelFormat.TRANSLUCENT);
    position.gravity=Gravity.TOP|Gravity.LEFT;position.x=65;position.y=290;
    bubble.setOnTouchListener(new View.OnTouchListener(){
      int sx,sy;float downX,downY;long downAt;boolean moved;
      @Override public boolean onTouch(View v,android.view.MotionEvent e){
        switch(e.getActionMasked()){
          case MotionEvent.ACTION_DOWN:
            sx=position.x;sy=position.y;downX=e.getRawX();downY=e.getRawY();downAt=System.currentTimeMillis();moved=false;return true;
          case MotionEvent.ACTION_MOVE:
            if(Math.abs(e.getRawX()-downX)>12||Math.abs(e.getRawY()-downY)>12)moved=true;
            if(moved){position.x=sx+(int)(e.getRawX()-downX);position.y=sy+(int)(e.getRawY()-downY);wm.updateViewLayout(bubble,position);}return true;
          case MotionEvent.ACTION_UP:
            if(!moved&&System.currentTimeMillis()-downAt<800)manualTap();return true;
        }
        return true;
      }
    });
    wm.addView(bubble,position);
  }
  private void manualTap(){
    if(bubble==null||position==null)return;
    final int x=position.x+position.width/2,y=position.y+position.height/2;
    bubble.setVisibility(View.INVISIBLE);
    handler.postDelayed(()->{
      Path path=new Path();path.moveTo(x,y);
      GestureDescription g=new GestureDescription.Builder()
        .addStroke(new GestureDescription.StrokeDescription(path,0,65)).build();
      dispatchGesture(g,new GestureResultCallback(){
        @Override public void onCompleted(GestureDescription gesture){restore();}
        @Override public void onCancelled(GestureDescription gesture){restore();}
      },handler);
      handler.postDelayed(this::restore,500);
    },110);
  }
  private void restore(){if(bubble!=null)bubble.setVisibility(View.VISIBLE);}
  private void hideBubble(){if(bubble!=null&&wm!=null){try{wm.removeView(bubble);}catch(Exception ignored){}bubble=null;}}
  @Override public void onDestroy(){hideBubble();active=null;super.onDestroy();}
}
