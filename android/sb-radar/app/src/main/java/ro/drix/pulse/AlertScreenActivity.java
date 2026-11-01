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
import android.view.animation.*;
import android.widget.*;

public class AlertScreenActivity extends Activity {
  private String path="/app?tab=live";
  private int notificationId=0;

  private GradientDrawable shape(int fill,int stroke,int radius) {
    GradientDrawable d=new GradientDrawable();
    d.setColor(fill);d.setCornerRadius(radius);
    if(stroke!=0)d.setStroke(2,stroke);
    return d;
  }
  private TextView text(String value,int size,int color,boolean bold) {
    TextView t=new TextView(this);
    t.setText(value);t.setTextColor(color);t.setTextSize(size);
    if(bold)t.setTypeface(null,Typeface.BOLD);
    t.setGravity(Gravity.CENTER);
    return t;
  }
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    if(Build.VERSION.SDK_INT>=27){setShowWhenLocked(true);setTurnScreenOn(true);}
    else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED|WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    getWindow().setStatusBarColor(0xff080e17);
    getWindow().setNavigationBarColor(0xff080e17);
    Intent incoming=getIntent();
    String title=incoming.getStringExtra("title");
    String body=incoming.getStringExtra("body");
    String p=incoming.getStringExtra("path");
    if(p!=null&&p.startsWith("/app?"))path=p;
    notificationId=incoming.getIntExtra("notification_id",0);
    boolean gold=title!=null&&title.toUpperCase(java.util.Locale.ROOT).contains("GOLD");
    int accent=gold?0xffffd46b:0xffff607d;
    int accentDark=gold?0xff593c10:0xff5a1b30;
    GradientDrawable background=new GradientDrawable(
      GradientDrawable.Orientation.TL_BR,
      gold?new int[]{0xff080e17,0xff35230d,0xff0b111c}:new int[]{0xff080e17,0xff371329,0xff0b111c}
    );
    ScrollView scroll=new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setBackground(background);
    LinearLayout page=new LinearLayout(this);
    page.setOrientation(LinearLayout.VERTICAL);
    page.setGravity(Gravity.CENTER);
    int pad=(int)(24*getResources().getDisplayMetrics().density);
    page.setPadding(pad,pad,pad,pad);
    scroll.addView(page,new ScrollView.LayoutParams(-1,-1));

    TextView eyebrow=text("● SB RADAR  •  SEMNAL DE PARIERE",12,accent,true);
    eyebrow.setLetterSpacing(.08f);
    page.addView(eyebrow,new LinearLayout.LayoutParams(-1,-2));

    TextView symbol=text(gold?"🏆":"🧠",76,accent,true);
    LinearLayout.LayoutParams symbolLayout=new LinearLayout.LayoutParams(-1,-2);
    symbolLayout.topMargin=pad/2;
    page.addView(symbol,symbolLayout);
    Animation pulse=new ScaleAnimation(.93f,1.09f,.93f,1.09f,
      Animation.RELATIVE_TO_SELF,.5f,Animation.RELATIVE_TO_SELF,.5f);
    pulse.setDuration(650);
    pulse.setRepeatCount(Animation.INFINITE);
    pulse.setRepeatMode(Animation.REVERSE);
    symbol.startAnimation(pulse);

    TextView headline=text(gold?"TE SUNĂ BANII!":"MACHINE LEARNING v2.0",30,accent,true);
    headline.setPadding(0,12,0,10);
    page.addView(headline,new LinearLayout.LayoutParams(-1,-2));
    TextView label=text(gold?"GOLDEN TICKET":"ALERTĂ ML • EGAL (X)",16,Color.WHITE,true);
    page.addView(label,new LinearLayout.LayoutParams(-1,-2));

    LinearLayout details=new LinearLayout(this);
    details.setOrientation(LinearLayout.VERTICAL);
    details.setPadding(pad,pad,pad,pad);
    details.setBackground(shape(accentDark,accent,28));
    LinearLayout.LayoutParams dlp=new LinearLayout.LayoutParams(-1,-2);
    dlp.topMargin=pad;
    dlp.bottomMargin=pad;
    page.addView(details,dlp);
    TextView fixture=text(body==null?"SEMNAL NOU":body,20,Color.WHITE,true);
    fixture.setLineSpacing(7,1f);
    details.addView(fixture,new LinearLayout.LayoutParams(-1,-2));
    TextView hint=text("VERIFICĂ COTA X ÎNAINTE SĂ PARIEZI",12,0xffe6e0dc,false);
    hint.setPadding(0,20,0,0);
    details.addView(hint);

    Button open=new Button(this);
    open.setText("DESCHIDE MECIUL • X");
    open.setAllCaps(false);
    open.setTextSize(17);
    open.setTypeface(null,Typeface.BOLD);
    open.setTextColor(0xff10141b);
    open.setBackgroundTintList(android.content.res.ColorStateList.valueOf(accent));
    page.addView(open,new LinearLayout.LayoutParams(-1,(int)(58*getResources().getDisplayMetrics().density)));
    open.setOnClickListener(v->{
      stopAndDismiss();
      Intent target=new Intent(this,MainActivity.class);
      target.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
      target.setData(Uri.parse(MainActivity.BASE+path));
      startActivity(target);finish();
    });
    Button dismiss=new Button(this);
    dismiss.setText("OPREȘTE SUNETUL ȘI ÎNCHIDE");
    dismiss.setAllCaps(false);
    LinearLayout.LayoutParams dp=new LinearLayout.LayoutParams(-1,-2);
    dp.topMargin=pad/2;
    page.addView(dismiss,dp);
    dismiss.setOnClickListener(v->{stopAndDismiss();finish();});
    TextView note=text("Alertă automată • soneria se oprește după 45 secunde",11,0xffadb9c7,false);
    note.setPadding(0,pad,0,0);
    page.addView(note);
    setContentView(scroll);
  }
  private void stopAndDismiss() {
    AlertService.silence(this);
    ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancel(notificationId);
  }
  @Override public void onBackPressed(){stopAndDismiss();super.onBackPressed();}
}
