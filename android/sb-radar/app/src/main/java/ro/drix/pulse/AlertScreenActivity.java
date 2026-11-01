package ro.drix.pulse;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.*;
import android.widget.*;

public class AlertScreenActivity extends Activity {
  private String path="/app?tab=live";
  private int notificationId=0;
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    if(Build.VERSION.SDK_INT>=27){setShowWhenLocked(true);setTurnScreenOn(true);}
    else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED|WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    Intent i=getIntent();
    String title=i.getStringExtra("title"),body=i.getStringExtra("body");
    String p=i.getStringExtra("path");
    if(p!=null&&p.startsWith("/app?"))path=p;
    notificationId=i.getIntExtra("notification_id",0);
    boolean gold=title!=null&&title.contains("GOLDEN");
    int accent=gold?0xffffc74f:0xffed4562;
    GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xff0b111b,gold?0xff42300a:0xff3a1020,0xff0b111b});
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setGravity(Gravity.CENTER);
    root.setPadding(36,48,36,40);root.setBackground(bg);
    TextView icon=new TextView(this);icon.setGravity(Gravity.CENTER);icon.setText(gold?"🏆":"🧠");icon.setTextSize(68);
    root.addView(icon,new LinearLayout.LayoutParams(-1,-2));
    TextView heading=new TextView(this);heading.setGravity(Gravity.CENTER);heading.setText(title==null?"SB Radar":title);
    heading.setTextColor(accent);heading.setTextSize(27);heading.setTypeface(null,Typeface.BOLD);
    heading.setPadding(0,25,0,16);root.addView(heading,new LinearLayout.LayoutParams(-1,-2));
    TextView detail=new TextView(this);detail.setGravity(Gravity.CENTER);detail.setText(body==null?"Semnal nou":body);
    detail.setTextColor(Color.WHITE);detail.setTextSize(19);detail.setPadding(0,6,0,32);
    root.addView(detail,new LinearLayout.LayoutParams(-1,-2));
    Button open=new Button(this);open.setText("DESCHIDE MECIUL");open.setTextColor(Color.BLACK);open.setBackgroundTintList(android.content.res.ColorStateList.valueOf(accent));
    root.addView(open,new LinearLayout.LayoutParams(-1,-2));open.setOnClickListener(v->{
      stopAndDismiss();
      Intent target=new Intent(this,MainActivity.class);
      target.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
      target.setData(Uri.parse(MainActivity.BASE+path));startActivity(target);finish();
    });
    Button dismiss=new Button(this);dismiss.setText("ÎNCHIDE ALERTA");root.addView(dismiss,new LinearLayout.LayoutParams(-1,-2));
    dismiss.setOnClickListener(v->{stopAndDismiss();finish();});
    TextView note=new TextView(this);note.setGravity(Gravity.CENTER);note.setText("SB Radar • alertă locală • nu este apel telefonic");
    note.setTextColor(0xffbac2cb);note.setTextSize(12);note.setPadding(0,26,0,0);root.addView(note);
    setContentView(root);
  }
  private void stopAndDismiss(){
    AlertService.silence(this);
    ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancel(notificationId);
  }
  @Override public void onBackPressed(){stopAndDismiss();super.onBackPressed();}
}
