package ro.drix.pulse;

import android.app.*;
import android.animation.ValueAnimator;
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
import android.view.animation.DecelerateInterpolator;
import android.view.animation.LinearInterpolator;
import android.widget.*;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Cinematic themed alert. Pure UI; FCM delivery, alarm and server remain untouched. */
public class AlertScreenActivity extends Activity {
  private String path="/app?tab=live";
  private int notificationId=0;
  private int accent;
  private float scale;
  private ValueAnimator cinematicPulse;

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
    String liveTitle=title==null?"":title.toUpperCase(Locale.ROOT);
    boolean purple=liveTitle.contains("ML LOGREG");
    boolean red=!purple&&liveTitle.contains("GOLDEN CLASSIC");
    boolean gold=title!=null&&title.toUpperCase(Locale.ROOT).contains("GOLDEN TICKET");
    boolean rush=title!=null&&title.toUpperCase(Locale.ROOT).contains("GOLD RUSH");
    boolean power=title!=null&&title.toUpperCase(Locale.ROOT).contains("GG POWER");
    boolean hourly=title!=null&&title.contains("ANTRENAT ORAR");
    accent=purple?0xff79e1f1:red?0xffffd479:power?0xffdfb0ff:gold?0xffeac16d:0xff69dcd3;
    int surface=0xff131a25;
    int line=purple?0xff477f99:red?0xff96723c:power?0xff8358a3:gold?0xff77623c:0xff336765;
    String raw=body==null?"":body.trim();
    String fixture=raw.isEmpty()?"Meci în monitorizare":raw.split("\\n",2)[0].trim();
    String minute=extract(raw,"(?:MINUTUL|MIN\\.)\\s*(\\d{1,3})","—");
    String score=extract(raw,"(?:SCOR|Scor)\\s*(\\d+\\s*[–-]\\s*\\d+)","—");
    String odds=extract(raw,"COT[ĂA]\\s*(\\d+(?:[\\.,]\\d+)?)",
      extract(raw,"(?:Egal \\(X\\)|X @)\\s*(\\d+(?:[\\.,]\\d+)?)","—"));
    String category57=extract(raw,"CATEGORIA (?:GOLDEN )?X57:\\s*([^\\r\\n]+)","");
    boolean test=raw.contains("test local")||raw.contains("NU PARIA");
    GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,
      new int[]{0xff090e17,purple?0xff221532:red?0xff2b131e:gold?0xff191911:0xff0e2326,0xff080d15});
    ScrollView scroll=new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setBackgroundColor(Color.TRANSPARENT);
    FrameLayout cinematicScene=new FrameLayout(this);
    cinematicScene.setBackground(bg);
    JackpotEffectsView energyField=new JackpotEffectsView(this,accent);
    cinematicScene.addView(energyField,new FrameLayout.LayoutParams(-1,-1));
    cinematicScene.addView(scroll,new FrameLayout.LayoutParams(-1,-1));
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setPadding(dp(19),dp(13),dp(19),dp(20));
    scroll.addView(root,new ScrollView.LayoutParams(-1,-1));

    TextView micro=label("S B  R A D A R",13,0xffe9d5f6,true,true);
    micro.setLetterSpacing(.16f);
    micro.setShadowLayer(dp(12),0,0,accent);
    root.addView(micro,lp(-1,-2));
    addGap(root,10);
    TextView jackpot=label(purple?"✦  ML INTELLIGENCE  ✦":red?"✦  GOLDEN CLASSIC  ✦":
      "✦  LIVE ALERT  ✦",23,accent,true,true);
    jackpot.setShadowLayer(dp(21),0,0,accent);
    jackpot.setLetterSpacing(.075f);
    root.addView(jackpot,lp(-1,-2));
    addGap(root,13);
    TextView rarity=label(purple?"🧠  ML LOGREG V1  •  57′–59′":red?"🟡  GOLDEN CLASSIC  •  57′":
      "✦  SB RADAR  ✦",12,0xffffe6aa,true,true);
    rarity.setLetterSpacing(.10f);
    rarity.setShadowLayer(dp(14),0,0,accent);
    root.addView(rarity,lp(-1,-2));
    addGap(root,18);

    LinearLayout card=new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setGravity(Gravity.CENTER_HORIZONTAL);
    card.setPadding(dp(13),dp(20),dp(13),dp(17));
    GradientDrawable cardFrame=new GradientDrawable(GradientDrawable.Orientation.TL_BR,
      new int[]{0xf8131727,purple?0xf5211539:red?0xf52b1426:0xf5231726,0xf8131724});
    cardFrame.setCornerRadius(dp(23));
    cardFrame.setStroke(dp(3),accent);
    card.setBackground(cardFrame);
    card.setElevation(dp(17));
    root.addView(card,lp(-1,-2));

    TextView symbol=label(purple?"✦  NIVEL MAXIM  ✦":red?"✦  PRIORITATE ÎNALTĂ  ✦":
      power?"⚡ GG POWER":gold?"◇ GOLD":rush?"◈ RUSH":"⌁ TEST AI",12,accent,true,true);
    symbol.setLetterSpacing(.12f);
    symbol.setShadowLayer(dp(11),0,0,accent);
    card.addView(symbol,lp(-1,-2));
    addGap(card,14);
    TextView heading=label(purple?"ML LOGREG\nV1":red?"GOLDEN\nCLASSIC":
      power?"GG POWER":gold?"GOLDEN TICKET":rush?"GOLD RUSH":hourly?"ML • ANTRENAT ORAR":"SEMNAL",
      purple||red?38:29,Color.WHITE,true,true);
    heading.setLetterSpacing(.06f);
    heading.setShadowLayer(dp(18),0,0,accent);
    heading.setLineSpacing(dp(1),1f);
    card.addView(heading,lp(-1,-2));
    addGap(card,5);
    TextView subtitle=label(test?"⚠ DEMONSTRAȚIE • NU PARIA":purple?"SCOR 0–0 • EGAL (X)":
      red?"MINUTUL 57 • EGAL (X)":gold?"TE SUNĂ BANII!":"SEMNAL • EGAL (X)",
      13,test?0xffffde94:accent,true,true);
    subtitle.setLetterSpacing(.12f);
    subtitle.setShadowLayer(dp(8),0,0,accent);
    card.addView(subtitle,lp(-1,-2));
    addGap(card,16);
    TextView stakes=label(purple?"57′–59′":red?"57′":"⚡ LIVE",purple||red?41:35,Color.WHITE,true,true);
    stakes.setLetterSpacing(.06f);
    stakes.setShadowLayer(dp(26),0,0,accent);
    card.addView(stakes,lp(-1,-2));
    addGap(card,14);
    View rule=new View(this);
    rule.setBackgroundColor(accent);
    card.addView(rule,lp(-1,1));
    addGap(card,19);
    TextView match=label(fixture,20,0xfff2f4f7,true,true);
    match.setShadowLayer(dp(4),0,0,accent);
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
      GradientDrawable chipBg=shape(0xe9222333,k==2?accent:0xff51445f,10);
      if(k==2)chipBg.setStroke(dp(2),accent);
      chip.setBackground(chipBg);
      chip.setPadding(dp(7),dp(9),dp(7),dp(9));
      LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(0,-2,k==2?1.2f:.8f);
      if(k>0)params.leftMargin=dp(6);
      row.addView(chip,params);
    }
    addGap(card,17);
    TextView note=label(test?"⚠ MOD TEST • NU PLASA PARIURI":purple?"STRONG + SILVER • VERIFICĂ PREȚUL X":
      red?"GOLDEN STRONG • VERIFICĂ PREȚUL X":"Verifică prețul X înainte de plasare",
      11,test?0xffffde94:0xffcbd1de,true,true);
    card.addView(note,lp(-1,-2));

    addGap(root,18);
    Button open=new Button(this);
    open.setText(test?"DESCHIDE SB RADAR    ↗":"DESCHIDE MECIUL    ↗");
    open.setTextSize(14);
    open.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));
    open.setLetterSpacing(.07f);
    open.setAllCaps(false);
    open.setTextColor(0xff091018);
    GradientDrawable openBg=new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
      purple?new int[]{0xff811cff,0xffe5aaff,0xff8f27ff}:
      red?new int[]{0xffdd1a41,0xffff97a6,0xffdf254b}:
      new int[]{0xffdda14a,0xffffffcf,0xffdca055});
    openBg.setCornerRadius(dp(12));
    open.setBackground(openBg);
    open.setElevation(dp(11));
    open.setShadowLayer(dp(14),0,0,accent);
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
    foot.setShadowLayer(dp(6),0,0,accent);
    root.addView(foot,lp(-1,-2));
    Animation appear=new AlphaAnimation(.65f,1f);
    appear.setDuration(700);
    appear.setRepeatCount(1);
    appear.setRepeatMode(Animation.REVERSE);
    symbol.startAnimation(appear);
    setContentView(cinematicScene);
    card.setAlpha(0f);card.setTranslationY(dp(37));
    card.animate().alpha(1f).translationY(0f).setDuration(650)
      .setInterpolator(new DecelerateInterpolator()).start();
    cinematicPulse=ValueAnimator.ofFloat(0f,1f);
    cinematicPulse.setDuration(1900);
    cinematicPulse.setRepeatCount(ValueAnimator.INFINITE);
    cinematicPulse.setInterpolator(new LinearInterpolator());
    cinematicPulse.addUpdateListener(a->{
      float t=(Float)a.getAnimatedValue();
      float wave=(float)(.5f+.5f*Math.sin(2*Math.PI*t));
      float ringScale=1f+.070f*wave;
      card.setScaleX(ringScale);card.setScaleY(ringScale);
      jackpot.setAlpha(.56f+.44f*wave);
      jackpot.setScaleX(1f+.15f*wave);jackpot.setScaleY(1f+.15f*wave);
      stakes.setScaleX(1f+.15f*wave);stakes.setScaleY(1f+.15f*wave);
      rarity.setAlpha(.6f+.4f*wave);
      cardFrame.setStroke(dp(3+5*wave),Color.argb(182+(int)(73*wave),
        Color.red(accent),Color.green(accent),Color.blue(accent)));
    });
    cinematicPulse.start();
  }
  @Override protected void onDestroy(){
    if(cinematicPulse!=null){cinematicPulse.cancel();cinematicPulse=null;}
    super.onDestroy();
  }
  private void stopAndDismiss(){
    AlertService.dismiss(this,notificationId);
  }
  @Override public void onBackPressed(){stopAndDismiss();super.onBackPressed();}
}
