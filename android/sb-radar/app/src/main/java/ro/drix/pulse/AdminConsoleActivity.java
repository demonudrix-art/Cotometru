package ro.drix.pulse;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Native SB Radar Admin — v2.3.22.
 * Chrome computers inherit the SB Radar account license from the server.
 * Approval still requires a one-time pairing code in the authenticated Admin.
 * No Chrome-specific payments, pricing or license revocation are exposed here.
 */
public final class AdminConsoleActivity extends Activity {
    static final String BASE = "https://ghost-equal-alert-v1.drix-beast-xray.workers.dev";
    static final int BG=0xFF0F0B17, PANEL=0xFF211B2D, PANEL_HI=0xFF30233F, WHITE=0xFFF8F2FF,
        MUTED=0xFFB6A9C3, STROKE=0xFF51415F, PURPLE=0xFFA75BE0, PURPLE_LIGHT=0xFFD8B1FF,
        RED=0xFFFA5878, GREEN=0xFF66E5B3, AMBER=0xFFFFD18A, TILE=0xFF171321;
    LinearLayout root, loginPanel, dashboard, pcList, phoneList, betsList, dialogsList, tabsRow, sectionPC, sectionPhones, sectionBets, sectionDialogs;
    TextView feedback, serverStatus, ownerLicense, ownerExpiry, pcCount, phoneCount, betCount, pulseSummary, pulseDetails;
    TextView[] tabs=new TextView[4];
    EditText username, password;
    final Handler timer=new Handler(Looper.getMainLooper());
    boolean running=false, busy=false, logged=false;
    int selectedTab=0;
    boolean pulseExpanded=false;
    String expandedPc="", expandedPhone="";
    final Runnable ticker=new Runnable(){
        @Override public void run(){if(running&&logged&&!busy)refresh();if(running)timer.postDelayed(this,15000);}
    };

    int dp(float value){return Math.round(value*getResources().getDisplayMetrics().density);}
    GradientDrawable shape(int fill,int border,float radius){
        GradientDrawable d=new GradientDrawable();d.setColor(fill);d.setCornerRadius(dp(radius));
        if(border!=0)d.setStroke(dp(1),border);return d;
    }
    GradientDrawable gradient(int top,int bottom,int border,float radius){
        GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{top,bottom});
        d.setCornerRadius(dp(radius));if(border!=0)d.setStroke(dp(1),border);return d;
    }
    LinearLayout vertical(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    LinearLayout horizontal(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    void add(LinearLayout parent,View child){parent.addView(child,new LinearLayout.LayoutParams(-1,ViewGroup.LayoutParams.WRAP_CONTENT));}
    void space(LinearLayout parent,int height){View v=new View(this);parent.addView(v,new LinearLayout.LayoutParams(1,dp(height)));}
    void padding(View v,int a,int b,int c,int d){v.setPadding(dp(a),dp(b),dp(c),dp(d));}
    TextView label(String value,int size,int color,boolean bold){
        TextView t=new TextView(this);t.setText(value);t.setTextColor(color);t.setTextSize(size);
        t.setGravity(Gravity.CENTER_VERTICAL);t.setIncludeFontPadding(true);
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;
    }
    TextView chip(String value,int color){
        TextView t=label(value,11,color,true);padding(t,9,5,9,5);
        t.setBackground(shape(PANEL_HI,color==GREEN?0xFF356F61:STROKE,40));return t;
    }
    LinearLayout panel(LinearLayout into,boolean featured){
        LinearLayout card=vertical();padding(card,15,15,15,15);
        card.setBackground(featured?gradient(0xFF352343,0xFF1A1B2A,0xFF72548D,18):shape(PANEL,STROKE,17));
        LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(-1,-2);
        params.setMargins(0,dp(7),0,dp(8));into.addView(card,params);return card;
    }
    TextView action(String value,boolean main,Runnable onClick){
        TextView t=label(value,13,WHITE,true);t.setGravity(Gravity.CENTER);
        padding(t,12,10,12,10);t.setMinHeight(dp(42));
        GradientDrawable background=main?gradient(0xFF9553DB,0xFFBA4DA4,0,12):shape(0xFF31273E,0xFF6C527B,12);
        t.setBackground(new RippleDrawable(ColorStateList.valueOf(0x55FFFFFF),background,null));
        t.setOnClickListener(v->onClick.run());t.setClickable(true);t.setFocusable(true);return t;
    }
    void rowAction(LinearLayout into,String value,boolean main,Runnable fn){
        TextView t=action(value,main,fn);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);
        p.topMargin=dp(8);into.addView(t,p);
    }
    EditText field(String hint,String defaultValue,boolean secret){
        EditText e=new EditText(this);e.setSingleLine(true);e.setHint(hint);
        e.setTextSize(14);e.setTextColor(WHITE);e.setHintTextColor(MUTED);
        e.setBackground(shape(TILE,STROKE,11));padding(e,12,10,12,10);
        e.setInputType(secret?InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD:InputType.TYPE_CLASS_TEXT);
        e.setText(defaultValue);return e;
    }
    JSONObject json(Object... values){
        JSONObject r=new JSONObject();try{for(int i=0;i+1<values.length;i+=2)r.put((String)values[i],values[i+1]);}catch(Exception ignored){}return r;
    }
    String timestamp(String raw){
        if(raw==null||raw.length()<10)return "—";
        try{
            SimpleDateFormat parse=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss",Locale.US);parse.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date time=parse.parse(raw.substring(0,Math.min(19,raw.length())));
            SimpleDateFormat format=new SimpleDateFormat("dd MMM yyyy, HH:mm",new Locale("ro","RO"));
            format.setTimeZone(TimeZone.getTimeZone("Europe/Bucharest"));return format.format(time);
        }catch(Exception ignored){return raw.length()>16?raw.substring(0,16):raw;}
    }
    interface Callback{void onSuccess(JSONObject data);}
    void request(java.util.concurrent.Callable<JSONObject> call,Callback callback){
        if(busy)return;busy=true;
        new Thread(()->{
            JSONObject data=null;Exception exception=null;
            try{data=call.call();}catch(Exception e){exception=e;}
            final JSONObject result=data;final Exception error=exception;
            runOnUiThread(()->{
                busy=false;
                if(error!=null){notify("Eroare conexiune: "+error.getMessage(),true);return;}
                callback.onSuccess(result);
            });
        },"SBR-Admin-Native").start();
    }
    JSONObject api(String endpoint,JSONObject payload)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(BASE+endpoint).openConnection();
        c.setConnectTimeout(11000);c.setReadTimeout(11000);
        c.setRequestProperty("Accept","application/json");
        String cookie=CookieManager.getInstance().getCookie(BASE);
        if(cookie!=null)c.setRequestProperty("Cookie",cookie);
        if(payload!=null){
            c.setRequestMethod("POST");c.setDoOutput(true);
            c.setRequestProperty("Origin",BASE);c.setRequestProperty("Content-Type","application/json");
            try(OutputStream out=c.getOutputStream()){out.write(payload.toString().getBytes(StandardCharsets.UTF_8));}
        }
        int status=c.getResponseCode();String session=c.getHeaderField("Set-Cookie");
        if(session!=null&&session.contains("sbr_session=")){
            CookieManager.getInstance().setCookie(BASE,session);CookieManager.getInstance().flush();
        }
        InputStream input=status>=200&&status<300?c.getInputStream():c.getErrorStream();
        StringBuilder response=new StringBuilder();
        if(input!=null)try(BufferedReader r=new BufferedReader(new InputStreamReader(input,StandardCharsets.UTF_8))){
            String line;while((line=r.readLine())!=null)response.append(line);
        }
        c.disconnect();
        JSONObject result=new JSONObject(response.length()==0?"{}":response.toString());
        if(status<200||status>=300)throw new IOException(result.optString("error","HTTP "+status));
        return result;
    }
    void notify(String value,boolean warning){
        feedback.setText(value);feedback.setTextColor(warning?AMBER:MUTED);
        feedback.setVisibility(value.isEmpty()?View.GONE:View.VISIBLE);
    }
    void state(boolean active){
        logged=active;loginPanel.setVisibility(active?View.GONE:View.VISIBLE);
        dashboard.setVisibility(active?View.VISIBLE:View.GONE);
    }
    void mutate(String endpoint,JSONObject payload,String success){
        request(()->api(endpoint,payload),response->{
            notify(success,false);
            if(endpoint.equals("/api/admin/logout"))state(false);else refresh();
        });
    }
    void confirm(String title,String description,Runnable run){
        new AlertDialog.Builder(this).setTitle(title).setMessage(description)
            .setNegativeButton("Anulează",null)
            .setPositiveButton("Confirmă",(dialog,which)->run.run()).show();
    }
    TextView addCount(LinearLayout to,String title){
        LinearLayout tile=vertical();padding(tile,11,9,11,9);tile.setBackground(shape(TILE,STROKE,12));
        TextView number=label("—",22,WHITE,true);add(tile,number);add(tile,label(title,10,MUTED,false));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.setMargins(dp(3),0,dp(3),0);to.addView(tile,p);
        return number;
    }
    @Override public void onCreate(Bundle bundle){
        super.onCreate(bundle);
        getWindow().setStatusBarColor(BG);getWindow().setNavigationBarColor(BG);
        ScrollView scrolling=new ScrollView(this);scrolling.setFillViewport(true);scrolling.setBackgroundColor(BG);
        root=vertical();padding(root,15,16,15,36);scrolling.addView(root);setContentView(scrolling);

        LinearLayout header=horizontal();
        TextView back=action("‹",false,this::finish);
        back.setTextSize(24);back.setMinWidth(dp(43));header.addView(back);
        LinearLayout brand=vertical();padding(brand,11,0,0,0);
        add(brand,label("SB RADAR  /  ADMIN",17,WHITE,true));
        add(brand,label("Controlul licențelor și calculatoarelor",11,MUTED,false));
        header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));add(root,header);
        space(root,12);
        feedback=label("",12,MUTED,false);feedback.setVisibility(View.GONE);add(root,feedback);

        loginPanel=vertical();LinearLayout loginCard=panel(loginPanel,true);
        add(loginCard,label("Administrator",19,WHITE,true));
        add(loginCard,label("Folosește contul Admin existent. Nu este nevoie de o a doua licență.",12,MUTED,false));
        space(loginCard,13);username=field("Utilizator","drix",false);add(loginCard,username);
        space(loginCard,9);password=field("Parolă Admin","",true);add(loginCard,password);
        rowAction(loginCard,"Conectează-te",true,()->request(
            ()->api("/api/admin/login",json("username",username.getText().toString().trim(),"password",password.getText().toString())),
            j->{password.setText("");state(true);refresh();}
        ));
        add(root,loginPanel);

        dashboard=vertical();add(root,dashboard);
        LinearLayout info=panel(dashboard,true);
        LinearLayout top=horizontal();
        LinearLayout left=vertical();add(left,label("CENTRU DE CONTROL",11,PURPLE_LIGHT,true));
        serverStatus=label("Se verifică serverul...",17,WHITE,true);add(left,serverStatus);
        top.addView(left,new LinearLayout.LayoutParams(0,-2,1));
        top.addView(chip("● LIVE",GREEN));add(info,top);
        space(info,10);
        ownerLicense=label("O singură licență SB Radar",17,GREEN,true);add(info,ownerLicense);
        ownerExpiry=label("Calculatoarele Chrome sunt incluse în abonament.",12,MUTED,false);add(info,ownerExpiry);
        space(info,8);
        add(info,label("Niciun tarif separat pentru extensii. Fiecare calculator nou se aprobă securizat cu un cod.",12,MUTED,false));

        LinearLayout pulseCard=panel(dashboard,false);
        TextView pulseHeader=label("◉  SYSTEM PULSE   ▾",14,PURPLE_LIGHT,true);
        add(pulseCard,pulseHeader);
        space(pulseCard,5);
        pulseSummary=label("Se verifică telemetria...",12,MUTED,false);
        add(pulseCard,pulseSummary);
        pulseDetails=label("",12,MUTED,false);
        pulseDetails.setVisibility(View.GONE);
        space(pulseCard,4);
        add(pulseCard,pulseDetails);
        pulseCard.setOnClickListener(v->{
            pulseExpanded=!pulseExpanded;
            pulseDetails.setVisibility(pulseExpanded?View.VISIBLE:View.GONE);
            pulseHeader.setText(pulseExpanded?"◉  SYSTEM PULSE   ▴":"◉  SYSTEM PULSE   ▾");
        });

        LinearLayout stats=horizontal();padding(stats,0,7,0,9);
        pcCount=addCount(stats,"Calculatoare");phoneCount=addCount(stats,"Telefoane");betCount=addCount(stats,"Bilete");add(dashboard,stats);

        LinearLayout toolbar=horizontal();
        TextView reload=action("↻  Actualizează",false,this::refresh);
        toolbar.addView(reload,new LinearLayout.LayoutParams(0,-2,1));
        TextView signOut=action("Deconectare",false,()->
            confirm("Deconectare Admin","Ieși din administrare pe acest telefon?",()->
                mutate("/api/admin/logout",json(),"Deconectat.")));
        LinearLayout.LayoutParams signParams=new LinearLayout.LayoutParams(0,-2,1);
        signParams.leftMargin=dp(8);toolbar.addView(signOut,signParams);add(dashboard,toolbar);
        space(dashboard,15);
        tabsRow=horizontal();add(dashboard,tabsRow);
        String[] titles={"PC","Android","Bilete","Ferestre"};
        for(int i=0;i<4;i++){
            final int id=i;TextView t=action(titles[i],false,()->switchTab(id));t.setTextSize(12);
            LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1);lp.setMargins(dp(2),0,dp(2),0);
            tabsRow.addView(t,lp);tabs[i]=t;
        }
        space(dashboard,10);

        sectionPC=vertical();add(dashboard,sectionPC);
        add(sectionPC,label("CALCULATOARE & EXTENSII",13,PURPLE_LIGHT,true));
        add(sectionPC,label("Un singur abonament. PC-uri nelimitate înregistrate, cu aprobare individuală.",12,MUTED,false));
        pcList=vertical();add(sectionPC,pcList);

        sectionPhones=vertical();add(dashboard,sectionPhones);
        add(sectionPhones,label("TELEFOANE ANDROID",13,PURPLE_LIGHT,true));
        add(sectionPhones,label("Administrează separat accesul telefoanelor de utilizatori. Extensiile nu au abonament propriu.",12,MUTED,false));
        phoneList=vertical();add(sectionPhones,phoneList);

        sectionBets=vertical();add(dashboard,sectionBets);
        add(sectionBets,label("BILETE • CHROME BRIDGE",13,PURPLE_LIGHT,true));
        add(sectionBets,label("Un bilet este confirmat numai după acceptarea Superbet și recuperarea identificatorului.",12,MUTED,false));
        betsList=vertical();add(sectionBets,betsList);

        sectionDialogs=vertical();add(dashboard,sectionDialogs);
        add(sectionDialogs,label("CERERI DE CONFIRMARE SUPERBET",13,PURPLE_LIGHT,true));
        add(sectionDialogs,label("După notificarea pe Samsung citește mesajul și aprobă explicit un singur clic. Cererile expiră după 3 minute. Alte dialoguri necesită intervenție la PC.",12,MUTED,false));
        dialogsList=vertical();add(sectionDialogs,dialogsList);

        LinearLayout footer=panel(dashboard,false);
        add(footer,label("Abonamente SB Radar",14,WHITE,true));
        add(footer,label("Lunar 39 lei · Anual 349 lei. Extensiile Chrome sunt incluse în licența contului. Stripe este încă în modul TEST; nu înregistra plăți reale aici.",11,MUTED,false));
        switchTab(getIntent()!=null&&getIntent().getBooleanExtra("SBR_OPEN_DIALOGS",false)?3:0);state(false);
        request(()->api("/api/admin/state",null),j->{
            state(j.optBoolean("authenticated"));
            if(logged)refresh();else notify("Autentifică-te pentru a administra SB Radar.",false);
        });
    }
    void switchTab(int id){
        selectedTab=id;
        for(int i=0;i<tabs.length;i++){
            tabs[i].setBackground(shape(i==id?0xFF603779:0xFF282033,i==id?PURPLE:STROKE,12));
            tabs[i].setTextColor(i==id?WHITE:MUTED);
        }
        sectionPC.setVisibility(id==0?View.VISIBLE:View.GONE);
        sectionPhones.setVisibility(id==1?View.VISIBLE:View.GONE);
        sectionBets.setVisibility(id==2?View.VISIBLE:View.GONE);
        sectionDialogs.setVisibility(id==3?View.VISIBLE:View.GONE);
    }
    void refresh(){
        if(!logged||busy)return;
        request(()->{
            JSONObject data=new JSONObject();
            data.put("chrome",api("/api/chrome/admin/devices",null));
            data.put("android",api("/api/admin/devices",null));
            data.put("bets",api("/api/chrome/admin/claims",null));
            data.put("dialogs",api("/api/chrome/admin/dialogs",null));
            try{data.put("pulse",SystemPulse.snapshot(this));}
            catch(Exception e){data.put("pulse_error",e.getClass().getSimpleName());}
            return data;
        },this::render);
    }
    void renderPulse(JSONObject pulse,String error){
        if(pulse==null){
            pulseSummary.setText("Telemetrie indisponibilă · Worker separat încă neactivat sau fără conexiune");
            pulseSummary.setTextColor(AMBER);
            pulseDetails.setText("Endpoint System Pulse: "+(error.isEmpty()?"fără răspuns":error)+"\nNu afectează scannerul sau biletele.");
            return;
        }
        JSONArray parts=pulse.optJSONArray("components");
        int green=0,amber=0,red=0;
        StringBuilder details=new StringBuilder();
        String[][] labels={{"cloudflare","Cloudflare"},{"feed","Superbet Live"},{"scanner","Scanner 57′"},{"chrome","Chrome Slaves"},{"notifications","FCM"},{"database","D1"},{"android","APK"},{"pipeline","Pipeline"}};
        for(String[] pair:labels){
            JSONObject x=null;
            if(parts!=null)for(int i=0;i<parts.length();i++){
                JSONObject p=parts.optJSONObject(i);
                if(p!=null&&pair[0].equals(p.optString("component"))){x=p;break;}
            }
            String status=x==null?"unknown":x.optString("status","unknown");
            String icon="ok".equals(status)?"●":"down".equals(status)?"✕":"◐";
            if("ok".equals(status))green++;
            else if("down".equals(status))red++;
            else amber++;
            details.append(icon).append("  ").append(pair[1]).append(" — ");
            details.append(x==null?"Fără date":x.optString("detail","Fără date")).append("\n");
        }
        int age=pulse.optInt("age_sec",-1);
        boolean stale=pulse.optBoolean("stale",true);
        pulseSummary.setText((red>0?"● INCIDENT":amber>0?"● DEGRADAT":"● FUNCȚIONAL")+"   ·   "
            +green+" OK   "+amber+" atenționări   "+red+" erori"
            +(age>=0?"   ·   "+age+"s":"")
            +(stale?"   ·   ÎNVECHIT":""));
        pulseSummary.setTextColor(red>0?RED:amber>0||stale?AMBER:GREEN);
        JSONArray incidents=pulse.optJSONArray("incidents");
        if(incidents!=null&&incidents.length()>0){
            JSONObject recent=incidents.optJSONObject(0);
            if(recent!=null)details.append("\nUltima schimbare: ")
                .append(recent.optString("component")).append(" → ")
                .append(recent.optString("new_status")).append("\n")
                .append(recent.optString("observed_utc"));
        }
        pulseDetails.setText(details.toString().trim());
    }
    void render(JSONObject response){
        JSONObject chrome=response.optJSONObject("chrome"),android=response.optJSONObject("android"),bets=response.optJSONObject("bets"),dialogs=response.optJSONObject("dialogs");
        if(chrome==null||android==null||bets==null||dialogs==null){notify("Răspuns incomplet de la server.",true);return;}
        JSONArray pcs=chrome.optJSONArray("devices"),phones=android.optJSONArray("devices"),claims=bets.optJSONArray("claims"),approvals=dialogs.optJSONArray("requests");
        int connected=chrome.optInt("online"),total=chrome.optInt("total");
        serverStatus.setText("SB Radar online · "+connected+"/"+total+" PC");
        pcCount.setText(String.valueOf(total));phoneCount.setText(String.valueOf(phones==null?0:phones.length()));
        int placed=0; if(claims!=null)for(int i=0;i<claims.length();i++){JSONObject x=claims.optJSONObject(i);if(x!=null&&"placed".equals(x.optString("state")))placed++;}
        betCount.setText(String.valueOf(placed));
        JSONObject lic=chrome.optJSONObject("account_license");
        boolean active=lic!=null&&lic.optBoolean("active");
        ownerLicense.setText(active?"● Licență SB Radar activă":"● Verifică licența SB Radar");
        ownerLicense.setTextColor(active?GREEN:AMBER);
        ownerExpiry.setText(active?"Valabilă până la "+timestamp(lic.optString("expires_utc"))+" · Chrome inclus":"Extensiile moștenesc licența activă a contului, fără plată pe PC.");
        tabs[0].setText("PC "+total);tabs[1].setText("Tel. "+(phones==null?0:phones.length()));tabs[2].setText("Bilete "+placed);
        int waiting=0;if(approvals!=null)for(int i=0;i<approvals.length();i++){JSONObject r=approvals.optJSONObject(i);if(r!=null&&"pending".equals(r.optString("status"))&&!r.optBoolean("expired"))waiting++;}
        tabs[3].setText("Ferestre "+waiting);
        renderPulse(response.optJSONObject("pulse"),response.optString("pulse_error",""));
        pcList.removeAllViews();
        if(pcs==null||pcs.length()==0){
            LinearLayout card=panel(pcList,false);add(card,label("Niciun calculator asociat",15,WHITE,true));
            add(card,label("Instalează Chrome Bridge, introdu utilizatorul și emailul, apoi aprobă codul de 6 cifre din acest ecran.",12,MUTED,false));
        }else for(int i=0;i<pcs.length();i++){JSONObject p=pcs.optJSONObject(i);if(p!=null)renderPC(p);}
        phoneList.removeAllViews();
        if(phones==null||phones.length()==0)add(phoneList,label("Nu există telefoane înregistrate.",12,MUTED,false));
        else for(int i=0;i<phones.length();i++){JSONObject p=phones.optJSONObject(i);if(p!=null)renderPhone(p);}
        betsList.removeAllViews();
        if(claims==null||claims.length()==0)add(betsList,label("Nu există bilete automate recente.",12,MUTED,false));
        else for(int i=0;i<Math.min(25,claims.length());i++){JSONObject p=claims.optJSONObject(i);if(p!=null)renderTicket(p);}
        dialogsList.removeAllViews();
        if(approvals==null||approvals.length()==0)add(dialogsList,label("Nu există popup-uri raportate.",12,MUTED,false));
        else for(int i=0;i<Math.min(25,approvals.length());i++){JSONObject d=approvals.optJSONObject(i);if(d!=null)renderDialog(d);}
    }
    void renderPC(JSONObject d){
        String id=d.optString("device_id"),name=d.optString("display_name","Calculator");
        String kind=d.optString("device_kind","computer");
        String deviceIcon="laptop".equals(kind)?"💻 ":"desktop".equals(kind)?"🖥️ ":"🖥 ";
        String status=d.optString("pairing_status"),version=d.optString("install_version","?");
        boolean online=d.optBoolean("online"),licensed=d.optBoolean("license_active");
        LinearLayout card=panel(pcList,false),title=horizontal();
        TextView heading=label((online?"● ":"● ")+deviceIcon+name,17,online?GREEN:MUTED,true);
        title.addView(heading,new LinearLayout.LayoutParams(0,-2,1));
        title.addView(chip("pending".equals(status)?"DE APROBAT":online?"ONLINE":"OFFLINE","pending".equals(status)?AMBER:online?GREEN:MUTED));
        add(card,title);
        add(card,label("Chrome Bridge v"+version+" · "+d.optString("owner_username")+" · "+("active".equals(status)?"Asociat":"pending".equals(status)?"În așteptare":"Revocat"),12,MUTED,false));
        add(card,label((licensed?"✓ Licența SB Radar inclusă":"⚠ Licență inactivă")+"  ·  "+(d.optInt("superbet_session_ok")==1?"Superbet conectat":"Superbet neconfirmat"),12,licensed?GREEN:AMBER,false));
        if("pending".equals(status)){
            space(card,8);
            EditText code=field("Cod asociere • 6 cifre","",false);
            code.setInputType(InputType.TYPE_CLASS_NUMBER);add(card,code);
            rowAction(card,"Aprobă calculatorul",true,()->{
                String digits=code.getText().toString().trim();
                if(!digits.matches("\\d{6}")){notify("Codul trebuie să conțină 6 cifre.",true);return;}
                mutate("/api/chrome/admin/approve",json("device_id",id,"code",digits),"Calculator aprobat. Licența SB Radar este inclusă.");
            });
        }else if("active".equals(status)){
            TextView more=label(expandedPc.equals(id)?"Detalii ▴":"Detalii și opțiuni ▾",12,PURPLE_LIGHT,true);
            padding(more,2,12,2,7);more.setClickable(true);more.setFocusable(true);add(card,more);
            LinearLayout details=vertical();
            add(details,label("Ultima comunicare: "+timestamp(d.optString("last_heartbeat_utc")),11,MUTED,false));
            add(details,label("Licență comună până la "+timestamp(d.optString("expires_utc")),11,MUTED,false));
            if(!d.optString("last_error").isEmpty())add(details,label("Ultima informare: "+d.optString("last_error"),11,AMBER,false));
            rowAction(details,"Revocă doar acest calculator",false,()->
                confirm("Revocă PC",name+" va pierde accesul. Celelalte calculatoare și licența SB Radar rămân active.",
                    ()->mutate("/api/chrome/admin/revoke",json("device_id",id),"Calculator revocat.")));
            details.setVisibility(expandedPc.equals(id)?View.VISIBLE:View.GONE);add(card,details);
            more.setOnClickListener(v->{expandedPc=details.getVisibility()==View.VISIBLE?"":id;
                details.setVisibility(expandedPc.equals(id)?View.VISIBLE:View.GONE);
                more.setText(expandedPc.equals(id)?"Detalii ▴":"Detalii și opțiuni ▾");});
        }
    }
    void renderPhone(JSONObject d){
        String id=d.optString("device_id");
        String owner=d.optString("profile_username");
        String titleName=owner.isEmpty()?d.optString("model","Telefon Android"):owner;
        String status=d.optString("license_status","PENDING");
        LinearLayout card=panel(phoneList,false);
        LinearLayout title=horizontal();
        title.addView(label("▣ "+titleName,16,WHITE,true),new LinearLayout.LayoutParams(0,-2,1));
        title.addView(chip(status,"ACTIVE".equals(status)?GREEN:AMBER));add(card,title);
        add(card,label("Expiră: "+timestamp(d.optString("expires_utc")),12,MUTED,false));
        TextView options=label(expandedPhone.equals(id)?"Administrare ▴":"Administrare licență ▾",12,PURPLE_LIGHT,true);
        padding(options,2,10,2,8);add(card,options);
        LinearLayout actions=vertical();
        rowAction(actions,"Prelungește cu 1 lună",false,()->
            confirm("Prelungește licența",titleName+" · Acordi o lună suplimentară?",
                ()->mutate("/api/admin/license",json("device_id",id,"count",1,"unit","month"),"Licență prelungită.")));
        rowAction(actions,"Revocă licența telefonului",false,()->
            confirm("Revocă licența",titleName+" · Sigur revoci accesul acestui telefon?",
                ()->mutate("/api/admin/revoke",json("device_id",id),"Acces revocat.")));
        actions.setVisibility(expandedPhone.equals(id)?View.VISIBLE:View.GONE);add(card,actions);
        options.setOnClickListener(v->{expandedPhone=actions.getVisibility()==View.VISIBLE?"":id;
            actions.setVisibility(expandedPhone.equals(id)?View.VISIBLE:View.GONE);
            options.setText(expandedPhone.equals(id)?"Administrare ▴":"Administrare licență ▾");});
    }
    void renderTicket(JSONObject d){
        String state=d.optString("state"),category=d.optString("signal_category");
        boolean accepted="placed".equals(state),question="unknown".equals(state);
        int color=accepted?GREEN:question?AMBER:MUTED;
        LinearLayout card=panel(betsList,false);
        add(card,label((accepted?"✓ ":question?"! ":"· ")+d.optString("fixture","Meci"),14,WHITE,true));
        String categoryLabel="strong-silver".equals(category)?"🟣 MOV":"strong".equals(category)?"🔴 ROȘU":"TEST";
        String status=accepted?"BILET CONFIRMAT":question?"REZULTAT INCERT":state.toUpperCase(Locale.ROOT);
        add(card,label(categoryLabel+" · "+status+" · "+d.optDouble("stake_lei",0)+" lei",12,color,true));
        String ticketId=d.optString("bookmaker_ticket_id");
        add(card,label((ticketId.isEmpty()?"ID Superbet în așteptare":"ID Superbet: "+ticketId)+" · "+timestamp(d.optString("updated_utc")),11,MUTED,false));
    }

    void renderDialog(JSONObject d){
        final String id=d.optString("request_id"),status=d.optString("status","pending"),
            name=d.optString("display_name","PC"),text=d.optString("dialog_text",""),
            labelButton=d.optString("button_label","OK");
        final boolean pending="pending".equals(status)&&!d.optBoolean("expired");
        final boolean canApprove=pending&&d.optInt("clickable",0)==1;
        LinearLayout card=panel(dialogsList,pending);
        add(card,label(("pending".equals(status)?"● ":"· ")+name+" · "+status.toUpperCase(Locale.ROOT),15,pending?PURPLE_LIGHT:MUTED,true));
        add(card,label(text.isEmpty()?"Textul dialogului nu este disponibil":text,13,WHITE,false));
        add(card,label("Buton: "+(labelButton.isEmpty()?"necunoscut":labelButton)+" · Expiră "+timestamp(d.optString("expires_utc")),11,MUTED,false));
        if(canApprove){
            rowAction(card,"Confirmă «"+labelButton+"» pe "+name,true,()->
                confirm("Confirmare Superbet",text+"\n\nAutorizezi un singur clic «"+labelButton+"» în browserul "+name+"?",()->
                    mutate("/api/chrome/admin/dialog/approve",json("request_id",id),"Aprobarea a fost trimisă către "+name+". Chrome o execută numai dacă dialogul este neschimbat.")));
        }else if(pending){
            add(card,label("Pentru această fereastră nu este permis clicul de la distanță. Verifică direct în browser.",12,AMBER,false));
        }
        if(pending)rowAction(card,"Ignoră această cerere",false,()->
            mutate("/api/chrome/admin/dialog/reject",json("request_id",id),"Cerere ignorată."));
    }
    @Override protected void onNewIntent(android.content.Intent intent){
        super.onNewIntent(intent);setIntent(intent);
        if(intent!=null&&intent.getBooleanExtra("SBR_OPEN_DIALOGS",false)){
            switchTab(3);
            if(logged)refresh();
        }
    }
    @Override protected void onResume(){
        super.onResume();running=true;timer.removeCallbacks(ticker);timer.postDelayed(ticker,15000);
    }
    @Override protected void onPause(){
        super.onPause();running=false;timer.removeCallbacks(ticker);
    }
}