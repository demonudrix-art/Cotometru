package ro.drix.pulse;

import android.app.*;
import android.content.*;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.widget.*;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Minimal, legible sci-fi alert; native screen does not depend on network fonts or WebView. */
public class AlertScreenActivity extends Activity {
  private String path="/app?tab=live";
  private int notificationId=0;
  private int accent;
  private float scale;

  private int dp(float value){return (int)(scale*value+.5f);}
  private LinearLayout.LayoutParams lp(int w,int h){return new LinearLayout.LayoutParams(w<0?w:dp(w),h<0?h:dp(h));}
  private GradientDrawable shape(int fill,int stroke,int radius){
    GradientDrawable d=new GradientDrawable();
    d.setColor(fill);d.setCornerRadius(dp(radius));
    if(stroke!=0)d.setStroke(dp(1),stroke);
    return d;
  }
  private TextView label(String value,float size,int color,boolean condensed,boolean bold){
    TextView t=new TextView(this);
    t.setText(value);
    t.setTextColor(color);
    t.setTextSize(size);
    t.setGravity(Gravity.CENTER);
    t.setTypeface(Typeface.create(condensed?"sans-serif-condensed":"sans-serif",
       bold?Typeface.BOLD:Typeface.NORMAL));
    t.setIncludeFontPadding(false);
    return t;
  }
  private void addGap(LinearLayout root,int height){
    View gap=new View(this);root.addView(gap,lp(1,height));
  }
  private String extract(String raw,String regex,String fallback){
    Matcher m=Pattern.compile(regex,Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE).matcher(raw);
    return m.find()?m.group(1):fallback;
  }
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    scale=getResources().getDisplayMetrics().density;
    if(Build.VERSION.SDK_INT>=27){setShowWhenLocked(true);setTurnScreenOn(true);}
    else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED|WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    getWindow().setStatusBarColor(0xff090e17);
    getWindow().setNavigationBarColor(0xff090e17);
    Intent intent=getIntent();
    String title=intent.getStringExtra("title"),body=intent.getStringExtra("body");
    String p=intent.getStringExtra("path");
    if(p!=null&&p.startsWith("/app?"))path=p;
    notificationId=intent.getIntExtra("notification_id",0);
    boolean gold=title!=null&&title.toUpperCase(Locale.ROOT).contains("GOLDEN TICKET");
    boolean rush=title!=null&&title.toUpperCase(Locale.ROOT).contains("GOLD RUSH");
    boolean power=title!=null&&title.toUpperCase(Locale.ROOT).contains("GG POWER");
    boolean hourly=title!=null&&title.contains("ANTRENAT ORAR");
    accent=power?0xffdfb0ff:gold?0xffeac16d:0xff69dcd3;
    int surface=0xff131a25;
    int line=power?0xff8358a3:gold?0xff77623c:0xff336765;
    String raw=body==null?"":body.trim();
    String fixture=raw.isEmpty()?"Meci în monitorizare":raw.split("\\n",2)[0].trim();
    String minute=extract(raw,"(?:MINUTUL|MIN\\.)\\s*(\\d{1,3})","—");
    String score=extract(raw,"(?:SCOR|Scor)\\s*(\\d+\\s*[–-]\\s*\\d+)","—");
    String odds=extract(raw,"COT[ĂA]\\s*(\\d+(?:[\\.,]\\d+)?)",
      extract(raw,"(?:Egal \\(X\\)|X @)\\s*(\\d+(?:[\\.,]\\d+)?)","—"));
    String category57=extract(raw,"CATEGORIA (?:GOLDEN )?X57:\\s*([^\\r\\n]+)","");
    boolean test=raw.contains("test local")||raw.contains("NU PARIA");
    GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,
      new int[]{0xff090e17,gold?0xff191911:0xff0e2326,0xff080d15});
    ScrollView scroll=new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setBackground(bg);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setPadding(dp(24),dp(24),dp(24),dp(28));
    scroll.addView(root,new ScrollView.LayoutParams(-1,-1));

    TextView micro=label("S B   R A D A R   /   L I V E   S I G N A L",11,0xff9aa6b8,true,true);
    root.addView(micro,lp(-1,-2));
    addGap(root,23);

    LinearLayout card=new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setGravity(Gravity.CENTER_HORIZONTAL);
    card.setPadding(dp(18),dp(23),dp(18),dp(20));
    card.setBackground(shape(surface,line,15));
    root.addView(card,lp(-1,-2));

    TextView symbol=label(power?"⚡  03 / GG POWER":gold?"◇  01 / GOLD":rush?"◈  02 / RUSH":"⌁  02 / AI",12,accent,true,true);
    symbol.setLetterSpacing(.12f);
    card.addView(symbol,lp(-1,-2));
    addGap(card,14);
    TextView heading=label(power?"GG POWER":gold?"GOLDEN TICKET":rush?"GOLD RUSH":hourly?"ML • ANTRENAT ORAR":"SEMNAL",24,Color.WHITE,true,true);
    heading.setLetterSpacing(.06f);
    card.addView(heading,lp(-1,-2));
    addGap(card,5);
    TextView subtitle=label(power?"GOLD RUSH + GOLDEN SILVER · X 2,05–2,14":gold?"TE SUNĂ BANII!":rush?"0–0 • MIN. 57 • X 2,05–2,14":hourly?"EGAL (X)":"SEMNAL • EGAL (X)",12,accent,true,true);
    subtitle.setLetterSpacing(.12f);
    card.addView(subtitle,lp(-1,-2));
    addGap(card,20);
    View rule=new View(this);
    rule.setBackgroundColor(line);
    card.addView(rule,lp(-1,1));
    addGap(card,21);
    TextView match=label(fixture,19,0xfff2f4f7,true,true);
    match.setMaxLines(3);
    match.setLineSpacing(dp(2),1f);
    card.addView(match,lp(-1,-2));
    if(!category57.isEmpty()){
      int categoryColor=category57.contains("NU PARIA")?0xffd899a4:0xffb5cbdd;
      TextView categoryCaption=label("CATEGORIA GOLDEN · "+category57,12,categoryColor,true,true);
      categoryCaption.setMaxLines(3);
      card.addView(categoryCaption,lp(-1,-2));
    }
    addGap(card,14);

    LinearLayout row=new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(Gravity.CENTER);
    row.setBaselineAligned(false);
    card.addView(row,lp(-1,-2));
    String[] values={minute+"′",score,"X  "+odds};
    for(int k=0;k<values.length;k++){
      TextView chip=label(values[k],16,k==2?accent:Color.WHITE,true,true);
      chip.setBackground(shape(0xff222a35,0xff34404d,9));
      chip.setPadding(dp(7),dp(9),dp(7),dp(9));
      LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(0,-2,k==2?1.2f:.8f);
      if(k>0)params.leftMargin=dp(6);
      row.addView(chip,params);
    }
    addGap(card,17);
    TextView note=label(test?"MOD TEST • NU PARIA":power?"GG Power • 50 lei · Prioritate Gold Rush, un singur semnal":rush?"Miză sugerată: 20 lei • Verifică X înainte de plasare":"Verifică prețul X înainte de plasare",11,0xff9caab7,false,false);
    card.addView(note,lp(-1,-2));

    addGap(root,18);
    Button open=new Button(this);
    open.setText("DESCHIDE MECIUL   ↗");
    open.setTextSize(14);
    open.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));
    open.setLetterSpacing(.07f);
    open.setAllCaps(false);
    open.setTextColor(0xff091018);
    open.setBackgroundTintList(ColorStateList.valueOf(accent));
    root.addView(open,lp(-1,51));
    open.setOnClickListener(v->{
      stopAndDismiss();
      Intent target=new Intent(this,MainActivity.class);
      target.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
      target.setData(Uri.parse(MainActivity.BASE+path));
      startActivity(target);finish();
    });
    addGap(root,9);
    Button dismiss=new Button(this);
    dismiss.setText("OPREȘTE ALERTA");
    dismiss.setTextSize(12);
    dismiss.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));
    dismiss.setAllCaps(false);
    dismiss.setTextColor(0xffc4cfda);
    dismiss.setBackgroundTintList(ColorStateList.valueOf(0xff222a35));
    root.addView(dismiss,lp(-1,43));
    dismiss.setOnClickListener(v->{stopAndDismiss();finish();});

    addGap(root,19);
    TextView foot=label("ALERTĂ SONORĂ   •   MAX. 45 SECUNDE",10,0xff82909d,true,false);
    foot.setLetterSpacing(.08f);
    root.addView(foot,lp(-1,-2));
    Animation appear=new AlphaAnimation(.65f,1f);
    appear.setDuration(700);
    appear.setRepeatCount(1);
    appear.setRepeatMode(Animation.REVERSE);
    symbol.startAnimation(appear);
    setContentView(scroll);
  }
  private void stopAndDismiss(){
    AlertService.dismiss(this,notificationId);
  }
  @Override public void onBackPressed(){stopAndDismiss();super.onBackPressed();}
}
