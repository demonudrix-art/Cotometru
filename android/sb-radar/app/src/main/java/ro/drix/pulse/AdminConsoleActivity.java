package ro.drix.pulse;
import android.app.*;import android.content.*;import android.os.*;import android.graphics.*;import android.graphics.drawable.*;import android.view.*;import android.webkit.CookieManager;import android.widget.*;import android.text.InputType;
import org.json.*;import java.net.*;import java.io.*;import java.nio.charset.StandardCharsets;import java.util.UUID;
public final class AdminConsoleActivity extends Activity {
 static final String BASE="https://ghost-equal-alert-v1.drix-beast-xray.workers.dev";
 static final int BG=0xff100c13,CARD=0xff241a29,WHITE=0xfff7edf5,SOFT=0xffb7abba,RED=0xffe62d50,GREEN=0xff69e7a5;
 LinearLayout root,login,body,pcList,androidList,claimsList;TextView message;EditText user,pass;
 Handler timer=new Handler(Looper.getMainLooper());boolean running=false,busy=false,logged=false;
 Runnable ticker=new Runnable(){public void run(){if(running&&logged&&!busy)refresh();if(running)timer.postDelayed(this,15000);}};
 GradientDrawable bg(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(13*getResources().getDisplayMetrics().density);return d;}
 TextView text(String s,int sp,int c){TextView x=new TextView(this);x.setText(s);x.setTextSize(sp);x.setTextColor(c);x.setPadding(8,7,8,7);return x;}
 LinearLayout col(){LinearLayout x=new LinearLayout(this);x.setOrientation(1);return x;}
 void append(LinearLayout to,View v){to.addView(v,new LinearLayout.LayoutParams(-1,-2));}
 void card(LinearLayout to,LinearLayout card){card.setPadding(13,12,13,12);card.setBackground(bg(CARD));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,7,0,9);to.addView(card,p);}
 Button btn(String s,Runnable run){Button b=new Button(this);b.setText(s);b.setAllCaps(false);b.setTextColor(WHITE);b.setTextSize(12);b.setBackground(bg(RED));b.setOnClickListener(v->run.run());return b;}
 EditText field(String hint,String value,boolean secret){EditText x=new EditText(this);x.setSingleLine(true);x.setHint(hint);x.setTextSize(15);x.setTextColor(WHITE);x.setHintTextColor(SOFT);x.setInputType(secret?InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD:InputType.TYPE_CLASS_TEXT);x.setText(value);return x;}
 JSONObject obj(Object... pairs){JSONObject j=new JSONObject();try{for(int i=0;i+1<pairs.length;i+=2)j.put((String)pairs[i],pairs[i+1]);}catch(Exception ignored){}return j;}
 void note(String s){message.setText(s);}
 interface Callback{void done(JSONObject j);}
 void work(java.util.concurrent.Callable<JSONObject> fn,Callback cb){if(busy)return;busy=true;new Thread(()->{JSONObject data=null;Exception err=null;try{data=fn.call();}catch(Exception e){err=e;}final JSONObject result=data;final Exception error=err;runOnUiThread(()->{busy=false;if(error!=null){note("Server: "+error.getMessage());return;}cb.done(result);});},"SBR-Admin").start();}
 JSONObject api(String path,JSONObject payload)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(BASE+path).openConnection();c.setConnectTimeout(11000);c.setReadTimeout(11000);c.setRequestProperty("Accept","application/json");
  String cookie=CookieManager.getInstance().getCookie(BASE);if(cookie!=null)c.setRequestProperty("Cookie",cookie);
  if(payload!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Origin",BASE);c.setRequestProperty("Content-Type","application/json");try(OutputStream o=c.getOutputStream()){o.write(payload.toString().getBytes(StandardCharsets.UTF_8));}}
  int status=c.getResponseCode();String sc=c.getHeaderField("Set-Cookie");if(sc!=null&&sc.contains("sbr_session=")){CookieManager.getInstance().setCookie(BASE,sc);CookieManager.getInstance().flush();}
  InputStream in=status>=200&&status<300?c.getInputStream():c.getErrorStream();StringBuilder sb=new StringBuilder();if(in!=null)try(BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8))){String line;while((line=r.readLine())!=null)sb.append(line);}
  c.disconnect();JSONObject j=new JSONObject(sb.length()==0?"{}":sb.toString());if(status<200||status>=300)throw new IOException(j.optString("error","HTTP "+status));return j;
 }
 void viewState(boolean ok){logged=ok;login.setVisibility(ok?View.GONE:View.VISIBLE);body.setVisibility(ok?View.VISIBLE:View.GONE);}
 void call(String path,JSONObject payload){work(()->api(path,payload),j->{note("Modificarea a fost salvată în Cloudflare.");refresh();});}
 void confirm(String title,String description,Runnable action){new AlertDialog.Builder(this).setTitle(title).setMessage(description).setNegativeButton("Renunță",null).setPositiveButton("Confirm",(d,w)->action.run()).show();}
 @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(BG);getWindow().setNavigationBarColor(BG);
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(BG);root=col();root.setPadding(14,15,14,35);scroll.addView(root);setContentView(scroll);
  append(root,text("SB RADAR • ADMIN",24,WHITE));append(root,btn("← Înapoi în SB Radar",this::finish));message=text("Se verifică sesiunea…",12,SOFT);append(root,message);
  login=col();card(root,login);append(login,text("Autentificare administrator",17,WHITE));user=field("Utilizator","drix",false);pass=field("Parolă Admin","",true);append(login,user);append(login,pass);
  append(login,btn("Autentifică-te",()->work(()->api("/api/admin/login",obj("username",user.getText().toString().trim(),"password",pass.getText().toString())),j->{pass.setText("");viewState(true);refresh();})));
  body=col();append(root,body);append(body,btn("Reîmprospătează toate licențele",this::refresh));append(body,btn("Deconectează Admin",()->call("/api/admin/logout",obj())));
  append(body,text("EXECUTORI CHROME • LICENȚE",18,WHITE));pcList=col();append(body,pcList);
  append(body,text("ANDROID • LICENȚE",18,WHITE));androidList=col();append(body,androidList);
  append(body,text("SLIP • BILETE AUTOMATE",18,WHITE));claimsList=col();append(body,claimsList);
  LinearLayout billing=col();card(body,billing);append(billing,text("ABONAMENTE ȘI PLĂȚI",16,WHITE));append(billing,text("Planurile existente: lunar 39 lei și anual 349 lei. Stripe este în modul TEST: nu încasa plăți reale. Licențele Chrome se pot tarifa individual prin Admin.",12,SOFT));
  viewState(false);work(()->api("/api/admin/state",null),j->{viewState(j.optBoolean("authenticated"));if(logged)refresh();else note("Autentifică-te cu contul Admin existent.");});
 }
 void refresh(){if(!logged||busy)return;work(()->{JSONObject j=new JSONObject();j.put("pc",api("/api/chrome/admin/devices",null));j.put("android",api("/api/admin/devices",null));j.put("slip",api("/api/chrome/admin/claims",null));return j;},this::render);}
 void render(JSONObject data){
  JSONObject pcs=data.optJSONObject("pc"),android=data.optJSONObject("android"),slip=data.optJSONObject("slip");if(pcs==null||android==null||slip==null)return;
  note("SB Radar online • "+pcs.optInt("online")+"/"+pcs.optInt("total")+" calculatoare conectate • Automatizare "+(pcs.optBoolean("execution_enabled")?"ACTIVĂ":"OPRITĂ"));
  pcList.removeAllViews();JSONArray array=pcs.optJSONArray("devices");if(array==null||array.length()==0)append(pcList,text("Nicio extensie conectată. Instalează Chrome Bridge v0.6 și aprobă codul aici.",12,SOFT));
  if(array!=null)for(int i=0;i<array.length();i++){JSONObject p=array.optJSONObject(i);if(p!=null)device(p);}
  androidList.removeAllViews();JSONArray phones=android.optJSONArray("devices");if(phones!=null)for(int i=0;i<phones.length();i++){JSONObject p=phones.optJSONObject(i);if(p!=null)phone(p);}
  claimsList.removeAllViews();JSONArray bets=slip.optJSONArray("claims");if(bets==null||bets.length()==0)append(claimsList,text("Încă nu există bilete automate confirmate.",12,SOFT));
  if(bets!=null)for(int i=0;i<Math.min(15,bets.length());i++){JSONObject p=bets.optJSONObject(i);if(p==null)continue;LinearLayout c=col();append(c,text(("placed".equals(p.optString("state"))?"✅ BILET PLASAT AUTOMAT":"⏳ "+p.optString("state").toUpperCase())+" • "+p.optString("fixture","Meci"),13,WHITE));append(c,text(p.optDouble("stake_lei")+" lei • "+p.optString("signal_category")+" • "+p.optString("bookmaker_ticket_id","Neconfirmat"),12,SOFT));card(claimsList,c);}
 }
 void device(JSONObject d){
  String id=d.optString("device_id"),name=d.optString("display_name"),state=d.optString("pairing_status");LinearLayout c=col();
  append(c,text((d.optBoolean("online")?"🟢 ":"🔴 ")+name,16,WHITE));append(c,text(state.toUpperCase()+" • "+d.optString("owner_username")+" • "+(d.optInt("superbet_session_ok")==1?"Superbet OK":"Superbet neconfirmat"),11,SOFT));
  append(c,text("Licență: "+(d.optBoolean("license_active")?"ACTIVĂ":"INACTIVĂ")+" • "+d.optDouble("monthly_price_lei")+" lei/"+d.optString("billing_cycle","monthly")+" • "+d.optString("expires_utc","fără expirare"),11,SOFT));
  if("pending".equals(state)){EditText code=field("Codul de 6 cifre","",false);code.setInputType(InputType.TYPE_CLASS_NUMBER);append(c,code);append(c,btn("Aprobă extensia",()->{String x=code.getText().toString().trim();if(!x.matches("[0-9]{6}")){note("Codul trebuie să aibă 6 cifre");return;}call("/api/chrome/admin/approve",obj("device_id",id,"code",x));}));}
  if("active".equals(state)){
   append(c,btn("Configurează prețul",()->plan(d)));
   append(c,btn("Înregistrează încasare / gratuit",()->pay(d)));
   append(c,btn("Revocă licența",()->confirm("Revocă licența",name,()->call("/api/chrome/admin/license-revoke",obj("device_id",id)))));
   append(c,btn("Revocă calculatorul",()->confirm("Dezactivează extensia",name,()->call("/api/chrome/admin/revoke",obj("device_id",id)))));
  }card(pcList,c);
 }
 void plan(JSONObject d){String id=d.optString("device_id");LinearLayout fields=col();fields.setPadding(15,0,15,0);
  EditText plan=field("Nume plan",d.optString("plan_name","Personalizat"),false),price=field("Preț lei/ciclu",String.valueOf(d.optDouble("monthly_price_lei",0)),false);
  price.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);append(fields,plan);append(fields,price);
  new AlertDialog.Builder(this).setTitle("Plan pentru "+d.optString("display_name")).setView(fields).setNeutralButton("Anual",(x,w)->savePlan(id,plan,price,"yearly")).setNegativeButton("Renunță",null).setPositiveButton("Lunar",(x,w)->savePlan(id,plan,price,"monthly")).show();
 }
 void savePlan(String id,EditText plan,EditText price,String cycle){try{double x=Double.parseDouble(price.getText().toString().replace(',','.'));if(x<0)throw new Exception();call("/api/chrome/admin/license-plan",obj("device_id",id,"plan_name",plan.getText().toString(),"price_lei",x,"billing_cycle",cycle));}catch(Exception e){note("Preț invalid.");}}
 void pay(JSONObject d){String id=d.optString("device_id");LinearLayout fields=col();fields.setPadding(15,0,15,0);EditText amount=field("Sumă încasată (0 = gratuit)",String.valueOf(d.optDouble("monthly_price_lei",0)),false);append(fields,amount);
  EditText days=field("Zile gratuite dacă suma = 0","30",false);append(fields,days);append(fields,text("Înregistrează numai bani deja încasați. Nu debitează clientul.",11,SOFT));
  new AlertDialog.Builder(this).setTitle("Licență "+d.optString("display_name")).setView(fields).setNegativeButton("Anulează",null).setPositiveButton("Înregistrează",(x,w)->{try{double a=Double.parseDouble(amount.getText().toString().replace(',','.'));int n=Integer.parseInt(days.getText().toString());if(a<0||n<1||n>3660)throw new Exception();confirm("Confirmare",a==0?"Acorzi "+n+" zile gratuite?":"Confirmi încasarea reală de "+a+" lei?",()->call("/api/chrome/admin/license-payment",obj("device_id",id,"amount_lei",a,"free_days",n,"payment_reference","manual-"+UUID.randomUUID())));}catch(Exception e){note("Date plată invalide.");}}).show();
 }
 void phone(JSONObject p){String id=p.optString("device_id"),who=p.optString("profile_username",p.optString("model","Telefon"));LinearLayout c=col();
  append(c,text("📱 "+who,15,WHITE));append(c,text("Licență: "+p.optString("license_status","PENDING")+" • Expiră: "+p.optString("expires_utc","—"),11,SOFT));
  append(c,btn("Acordă 1 lună",()->confirm("Licență Android",who,()->call("/api/admin/license",obj("device_id",id,"count",1,"unit","month")))));
  append(c,btn("Revocă licența",()->confirm("Revocare Android",who,()->call("/api/admin/revoke",obj("device_id",id)))));
  card(androidList,c);
 }
 @Override protected void onResume(){super.onResume();running=true;timer.removeCallbacks(ticker);timer.postDelayed(ticker,15000);}
 @Override protected void onPause(){super.onPause();running=false;timer.removeCallbacks(ticker);}
}
