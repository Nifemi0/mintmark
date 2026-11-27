import sys,glob
from PIL import Image, ImageDraw
d=sys.argv[1]; out=sys.argv[2]; cols=int(sys.argv[3]) if len(sys.argv)>3 else 3
fs=sorted(glob.glob(d+'/*.png'),key=lambda f:float(f.split('s-')[-1][:-4]))
w,h=640,360; rows=(len(fs)+cols-1)//cols
S=Image.new('RGB',(cols*w,rows*h),'black')
for i,f in enumerate(fs):
  im=Image.open(f).convert('RGB').resize((w,h),Image.LANCZOS)
  ImageDraw.Draw(im).text((8,6),f.split('s-')[-1][:-4],fill=(255,0,0))
  S.paste(im,((i%cols)*w,(i//cols)*h))
S.save(out,quality=88)
