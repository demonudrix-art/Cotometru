package ro.cotometru.radar;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
public final class MainActivity extends Activity {
 private static final String HOME="https://cotometru.ro/";
 private WebView browser; private EditText search;
 private int dp(float v){return (int)(getResources().getDisplayMetrics().density*v+0.5f);}
 private GradientDrawable bg(int c,int r){GradientDrawable d=new GradientDrawable();d.setColor(c);d.setCornerRadius(dp(r));return d;}
 private TextView button(String t){TextView a=new TextView(this);a.setText(t);a.setTextColor(Color.rgb(185,245,118));a.setTextSize(20);a.setGravity(Gravity.CENTER);a.setTypeface(null,Typeface.BOLD);return a;}
 @Override public void onCreate(Bundle saved){super.onCreate(saved);getWindow().setStatusBarColor(Color.rgb(8,24,40));getWindow().setNavigationBarColor(Color.rgb(8,24,40));
 LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(Color.rgb(9,26,42));
 LinearLayout bar=new LinearLayout(this);bar.setPadding(dp(8),dp(8),dp(8),dp(8));bar.setGravity(Gravity.CENTER_VERTICAL);
 TextView home=button("◎");bar.addView(home,new LinearLayout.LayoutParams(dp(48),dp(45)));
 home.setOnClickListener(v->browser.loadUrl(HOME));
 search=new EditText(this);search.setSingleLine(true);search.setTextSize(14);search.setHint("Caută produs, EAN...");search.setHintTextColor(Color.GRAY);search.setTextColor(Color.BLACK);search.setBackground(bg(Color.WHITE,10));search.setPadding(dp(10),0,dp(10),0);
 bar.addView(search,new LinearLayout.LayoutParams(0,dp(44),1));search.setOnEditorActionListener((v,i,e)->{doSearch();return true;});
 TextView go=button("⌕");bar.addView(go,new LinearLayout.LayoutParams(dp(48),dp(44)));go.setOnClickListener(v->doSearch());root.addView(bar);
 browser=new WebView(this);WebSettings s=browser.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setJavaScriptCanOpenWindowsAutomatically(false);
 browser.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();String h=u.getHost();if("https".equals(u.getScheme())&&("cotometru.ro".equals(h)||"www.cotometru.ro".equals(h)))return false;try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;}});
 browser.setWebChromeClient(new WebChromeClient());root.addView(browser,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
 String initial=HOME;Intent intent=getIntent();if(intent!=null){if(Intent.ACTION_SEND.equals(intent.getAction())&&"text/plain".equals(intent.getType())){String t=intent.getStringExtra(Intent.EXTRA_TEXT);if(t!=null)initial=HOME+"cauta?q="+Uri.encode(t.length()>150?t.substring(0,150):t);}else if(Intent.ACTION_VIEW.equals(intent.getAction())&&intent.getData()!=null){Uri u=intent.getData();if("https".equals(u.getScheme())&&"cotometru.ro".equals(u.getHost()))initial=u.toString();}}browser.loadUrl(initial);
 }
 private void doSearch(){String t=search.getText().toString().trim();if(!t.isEmpty())browser.loadUrl(HOME+"cauta?q="+Uri.encode(t));((InputMethodManager)getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(search.getWindowToken(),0);search.clearFocus();}
 @Override public void onBackPressed(){if(browser!=null&&browser.canGoBack())browser.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(browser!=null)browser.destroy();super.onDestroy();}
}
