package ro.drix.pulse;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.widget.*;
import org.json.*;
import java.net.*;
import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;

final class LottoPanel extends LinearLayout {
  private static final String BASE="https://sb-lotto-research-v1.drix-beast-xray.workers.dev";
  private final Handler timer=new Handler(Looper.getMainLooper());
  private final TextView status, title;
  private final LinearLayout cards;
  private String game="GR_KINO";
  private boolean active=false;
  private int generation=0;
  private final Runnable tick=new Runnable(){public void run(){if(active){refresh();timer.postDelayed(this,60000);}}};
  LottoPanel(Context c){
    super(c);setOrientation(VERTICAL);setBackgroundColor(0xff101719);setPadding(dp(16),dp(16),dp(16),dp(10));
    title=label("SB LOTTO",24,0xffe6f4ff);addView(title);
    addView(label("Rezultate şi cercetare statistică • fără semnale validate",12,0xff9aabbc));
    LinearLayout bar=new LinearLayout(c);bar.setOrientation(HORIZONTAL);bar.setGravity(Gravity.CENTER);
    Button gr=new Button(c);gr.setText("Grecia 20/80");gr.setOnClickListener(v->choose("GR_KINO"));
    Button it=new Button(c);it.setText("Italia 20/90");it.setOnClickListener(v->choose("IT_KENO"));
    bar.addView(gr,new LayoutParams(0,-2,1));bar.addView(it,new LayoutParams(0,-2,1));addView(bar);
    status=label("Se încarcă istoricul…",13,0xffd5bd85);addView(status);
    ScrollView scroll=new ScrollView(c);cards=new LinearLayout(c);cards.setOrientation(VERTICAL);scroll.addView(cards);addView(scroll,new LayoutParams(-1,0,1));
  }
  private int dp(int x){return Math.round(x*getResources().getDisplayMetrics().density);}
  private TextView label(String t,int size,int color){TextView v=new TextView(getContext());v.setText(t);v.setTextSize(size);v.setTextColor(color);v.setPadding(0,dp(6),0,dp(6));return v;}
  void start(){if(active)return;active=true;timer.removeCallbacks(tick);timer.post(tick);}
  void stop(){active=false;generation++;timer.removeCallbacks(tick);}
  private void choose(String x){if(game.equals(x))return;game=x;cards.removeAllViews();status.setText("Se încarcă istoricul…");if(active){timer.removeCallbacks(tick);timer.post(tick);}}
  private JSONObject get(String path)throws Exception{
    HttpURLConnection conn=(HttpURLConnection)new URL(BASE+path).openConnection();
    conn.setConnectTimeout(8000);conn.setReadTimeout(8000);conn.setInstanceFollowRedirects(false);
    try{if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
      try(InputStream in=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
        byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>1000000)throw new IOException("response too large");out.write(b,0,n);}return new JSONObject(out.toString("UTF-8"));
      }
    }finally{conn.disconnect();}
  }
  private void refresh(){
    final int ticket=++generation;final String selected=game;
    new Thread(()->{
      try{JSONObject h=get("/history?game="+selected);JSONArray rows=h.optJSONArray("rows");
        if(rows==null)throw new IOException("invalid rows");
        timer.post(()->{if(active&&ticket==generation)render(rows,selected);});
      }catch(Exception e){timer.post(()->{if(active&&ticket==generation)status.setText("Feed indisponibil. Datele anterioare nu sunt confirmate live.");});}
    },"sb-lotto-history").start();
  }
  private void render(JSONArray rows,String selected){
    cards.removeAllViews();int limit=selected.equals("GR_KINO")?80:90;
    double p=20.0*19/(limit*(limit-1));title.setText(selected.equals("GR_KINO")?"SB LOTTO • GRECIA":"SB LOTTO • ITALIA");
    if(rows.length()==0){status.setText("Nicio extragere în baza de date.");return;}
    long newest=rows.optJSONObject(0)==null?0:rows.optJSONObject(0).optLong("draw_time_ms");
    boolean fresh=newest>0&&System.currentTimeMillis()-newest<20*60000L;
    status.setText((fresh?"Rezultate recente":"Istoric • feed posibil întârziat")+" | "+rows.length()+" extrageri afişate");
    cards.addView(label(String.format(Locale.US,"Probabilitate teoretică 2/2: %.2f%% · Istoricul nu garantează următoarea extragere.",100*p),12,0xff9aabbc));
    SimpleDateFormat fmt=new SimpleDateFormat("dd.MM HH:mm",new Locale("ro","RO"));fmt.setTimeZone(TimeZone.getTimeZone("Europe/Bucharest"));
    for(int i=0;i<rows.length();i++){
      JSONObject r=rows.optJSONObject(i);if(r==null)continue;JSONArray nums=r.optJSONArray("numbers");if(nums==null||nums.length()!=20)continue;
      TextView head=label(fmt.format(new Date(r.optLong("draw_time_ms")))+"  #"+r.optString("draw_id")+"  •  "+(r.optInt("verified")==1?"sursă oficială":"sursă neconfirmată"),12,0xff9aabbc);cards.addView(head);
      StringBuilder s=new StringBuilder();for(int j=0;j<20;j++){if(j>0)s.append(j%10==0?"\n":"  ");s.append(String.format(Locale.US,"%02d",nums.optInt(j)));}TextView n=label(s.toString(),16,0xffe6f4ff);n.setBackgroundColor(0xff202d37);n.setPadding(dp(8),dp(10),dp(8),dp(10));cards.addView(n);
    }
  }
}
