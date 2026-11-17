package ro.drix.pulse;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;

/** Original, lightweight, category-specific animated-vector canvas for the full-screen alert. */
final class NatureGlyphView extends View {
  static final int BIRD=1, WIND=2, WATER=3;
  private final int kind;
  private final int tone;
  private final Paint pen=new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Path path=new Path();

  NatureGlyphView(Context ctx,int kind,int tone) {
    super(ctx); this.kind=kind; this.tone=tone; setLayerType(View.LAYER_TYPE_SOFTWARE,null);
    setContentDescription(kind==BIRD?"Golden Classic – pasăre":kind==WIND?"ML Select – adiere":"GAP NAVY – picături");
  }
  private void style(float width){
    pen.setColor(tone);pen.setStrokeWidth(width);pen.setStrokeCap(Paint.Cap.ROUND);
    pen.setStrokeJoin(Paint.Join.ROUND);pen.setStyle(Paint.Style.STROKE);
    pen.setShadowLayer(5,0,0,Color.argb(110,Color.red(tone),Color.green(tone),Color.blue(tone)));
  }
  private void drawPath(Canvas c){c.drawPath(path,pen);path.reset();}
  @Override protected void onDraw(Canvas c){
    super.onDraw(c);
    final float scale=Math.min(getWidth(),getHeight())/100f;
    c.save();c.translate((getWidth()-100*scale)/2,(getHeight()-100*scale)/2);c.scale(scale,scale);
    style(4.0f);
    if(kind==BIRD){
      path.moveTo(13,61);path.cubicTo(23,44,38,42,49,48);
      path.cubicTo(55,33,70,30,83,35);path.cubicTo(82,50,72,60,57,65);
      path.cubicTo(44,76,25,79,13,61);drawPath(c);
      path.moveTo(49,48);path.cubicTo(47,34,51,24,60,18);
      path.cubicTo(69,29,70,39,66,46);drawPath(c);
      path.moveTo(54,66);path.lineTo(52,83);path.moveTo(42,83);path.lineTo(63,83);drawPath(c);
      path.moveTo(83,35);path.lineTo(93,31);drawPath(c);
      pen.setStyle(Paint.Style.FILL);c.drawCircle(73,40,2.7f,pen);
    }else if(kind==WIND){
      path.moveTo(13,32);path.lineTo(67,32);path.cubicTo(84,32,86,16,74,16);
      path.cubicTo(68,16,64,19,64,24);drawPath(c);
      path.moveTo(10,50);path.lineTo(81,50);path.cubicTo(95,50,96,67,83,68);
      path.cubicTo(77,68,74,63,75,59);drawPath(c);
      path.moveTo(19,71);path.lineTo(54,71);path.cubicTo(69,71,70,85,59,85);
      path.cubicTo(55,85,51,82,51,78);drawPath(c);
    }else{
      path.moveTo(50,12);path.cubicTo(40,27,23,46,23,62);
      path.cubicTo(23,77,35,88,50,88);path.cubicTo(65,88,77,77,77,62);
      path.cubicTo(77,46,60,27,50,12);drawPath(c);
      path.moveTo(35,60);path.cubicTo(35,70,40,76,49,78);drawPath(c);
      pen.setAlpha(150);path.moveTo(20,93);path.cubicTo(38,99,63,99,80,93);drawPath(c);
    }
    c.restore();
  }
}
