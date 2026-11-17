import re,sys
root=sys.argv[1]
h=open(root+'/index.html').read().split('\n')
s=next(i for i,l in enumerate(h) if l.startswith('<script type="module">'))
e=next(i for i in range(s,len(h)) if h[i].strip()=='</script>')
sim=open(root+'/src/sim.js').read(); sim=re.sub(r'^export ','',sim,flags=re.M)
main=open(root+'/src/main.js').read()
for mark,f in [('/*SIM*/',None),('/*GLYPHS*/','glyphs.js'),('/*SPORT*/','sportscar.js'),('/*GLBCAR*/','glbcar.js'),('/*TRACK6*/','track6data.js'),('/*DESERT*/','desertdata.js'),('/*GLBTRACK*/','glbtrack.js')]:
    txt = sim if mark=='/*SIM*/' else open(root+'/src/'+f).read()
    main=main.replace(mark,txt)
if len(sys.argv)>2 and sys.argv[2]=='check':
    print(main.strip()==('\n'.join(h[s+1:e])).strip()); sys.exit()
h[s+1:e]=[main]
open(root+'/index.html','w').write('\n'.join(h))
print('built')
